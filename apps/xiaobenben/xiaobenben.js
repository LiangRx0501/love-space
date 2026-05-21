import { Auth } from '../home/js/auth.js';
import { supabase } from '../home/js/supabase.js';
import { LoadingScreen } from '../load/loading.js?v=load-4';
import {
    createSharedNote,
    fetchSharedNotes,
    updateSharedNote
} from '../shared/shared-notes-service.js';

const state = {
    notes: [],
    currentNickname: '',
    realtimeChannel: null,
    isRefreshing: false,
    saveTimers: new Map(),
    isMetaOpen: false
};

const els = {
    loginHint: document.getElementById('login-hint'),
    notesList: document.getElementById('notes-list'),
    newNoteInput: document.getElementById('new-note-input')
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function noteText(note) {
    return String(note.title || note.content || '').trim();
}

function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function formatMetaDate(value) {
    if (!value) return '刚刚';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '刚刚';
    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
    });
}

function sortNotes(notes) {
    return [...notes].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
    });
}

function updateLocalNote(updated) {
    state.notes = state.notes.map((note) => String(note.id) === String(updated.id) ? updated : note);
}

async function saveText(noteId, text, { shouldRender = false } = {}) {
    const note = state.notes.find((item) => String(item.id) === String(noteId));
    if (!note) return;

    const cleanText = text.trim();
    if (cleanText === noteText(note)) return;

    const updated = await updateSharedNote(note.id, {
        title: cleanText || '未命名',
        content: '',
        note_type: note.note_type || 'note',
        status: note.status || 'active',
        is_pinned: note.is_pinned === true,
        updated_by_nickname: state.currentNickname,
        updated_at: new Date().toISOString()
    });

    updateLocalNote(updated);
    if (shouldRender) render();
}

function queueSaveText(noteId, text) {
    if (state.saveTimers.has(noteId)) {
        clearTimeout(state.saveTimers.get(noteId));
    }

    state.saveTimers.set(noteId, setTimeout(async () => {
        state.saveTimers.delete(noteId);
        try {
            await saveText(noteId, text);
        } catch (error) {
            alert(`保存失败：${error.message || '未知错误'}`);
        }
    }, 650));
}

async function toggleDone(noteId) {
    const note = state.notes.find((item) => String(item.id) === String(noteId));
    if (!note) return;

    const updated = await updateSharedNote(note.id, {
        status: note.status === 'done' ? 'active' : 'done',
        is_pinned: false,
        updated_by_nickname: state.currentNickname,
        updated_at: new Date().toISOString()
    });

    updateLocalNote(updated);
    render();
}

async function createNoteFromInput() {
    const text = els.newNoteInput.value.trim();
    if (!text) return;

    els.newNoteInput.value = '';
    const now = new Date().toISOString();
    const created = await createSharedNote({
        title: text,
        content: '',
        note_type: 'note',
        status: 'active',
        is_pinned: false,
        created_by_nickname: state.currentNickname,
        updated_by_nickname: state.currentNickname,
        source_type: 'manual',
        source_ref: null,
        created_at: now,
        updated_at: now
    });

    state.notes = [created, ...state.notes];
    state.isMetaOpen = false;
    render();
    els.newNoteInput.focus();
}

function renderNote(note) {
    const isDone = note.status === 'done';
    const editor = note.updated_by_nickname || note.created_by_nickname || '未知';
    const time = formatMetaDate(note.updated_at || note.created_at);

    return `
        <article class="note-row-wrap ${state.isMetaOpen ? 'is-meta-open' : ''}" data-id="${note.id}">
            <div class="note-meta-drawer" aria-hidden="${state.isMetaOpen ? 'false' : 'true'}">
                <span class="meta-editor">${escapeHtml(editor)}</span>
                <span class="meta-time">${escapeHtml(time)}</span>
            </div>
            <div class="note-row ${isDone ? 'is-done' : ''}">
                <button class="check-button ${isDone ? 'is-done' : ''}" type="button" data-role="toggle-done"
                    aria-label="${isDone ? '标记为未完成' : '标记为完成'}"></button>
                <textarea class="note-input" rows="1" data-role="note-text" spellcheck="false">${escapeHtml(noteText(note))}</textarea>
            </div>
        </article>
    `;
}

function bindSwipe(rowWrap) {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    rowWrap.addEventListener('pointerdown', (event) => {
        startX = event.clientX;
        startY = event.clientY;
        tracking = true;
    });

    rowWrap.addEventListener('pointerup', (event) => {
        if (!tracking) return;
        tracking = false;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dy) > 40 || Math.abs(dx) < 42) return;

        state.isMetaOpen = dx > 0;
        render();
    });
}

function render() {
    const notes = sortNotes(state.notes);

    if (!notes.length) {
        els.notesList.innerHTML = '<div class="empty-state">点下面空白处，写下第一条小笨笨。</div>';
    } else {
        els.notesList.innerHTML = notes.map(renderNote).join('');
    }

    els.notesList.querySelectorAll('.note-row-wrap').forEach((rowWrap) => {
        const noteId = rowWrap.dataset.id;
        bindSwipe(rowWrap);

        rowWrap.querySelector('[data-role="toggle-done"]').addEventListener('click', async (event) => {
            event.stopPropagation();
            try {
                await toggleDone(noteId);
            } catch (error) {
                alert(`切换完成状态失败：${error.message || '未知错误'}`);
            }
        });

        const input = rowWrap.querySelector('[data-role="note-text"]');
        autoGrow(input);
        input.addEventListener('input', () => {
            autoGrow(input);
            queueSaveText(noteId, input.value);
        });
        input.addEventListener('blur', async () => {
            if (state.saveTimers.has(noteId)) {
                clearTimeout(state.saveTimers.get(noteId));
                state.saveTimers.delete(noteId);
            }
            try {
                await saveText(noteId, input.value, { shouldRender: true });
            } catch (error) {
                alert(`保存失败：${error.message || '未知错误'}`);
            }
        });
    });
}

async function ensureLogin() {
    const isLoggedIn = await Auth.init();
    if (!isLoggedIn) {
        els.loginHint.classList.remove('hidden');
        setTimeout(() => {
            LoadingScreen.goTo('../../');
        }, 700);
        return false;
    }

    state.currentNickname = Auth.getMyNickname() || 'Love Space 用户';
    return true;
}

async function refreshNotes() {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    try {
        state.notes = await fetchSharedNotes();
        render();
    } finally {
        state.isRefreshing = false;
    }
}

function setupRealtimeSync() {
    if (state.realtimeChannel) return;

    state.realtimeChannel = supabase
        .channel('shared-notes-realtime')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'shared_notes'
        }, async () => {
            try {
                await refreshNotes();
            } catch (error) {
                console.error('小笨笨实时同步失败：', error);
            }
        })
        .subscribe();
}

function teardownRealtimeSync() {
    if (!state.realtimeChannel) return;
    supabase.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
}

function bindEvents() {
    els.newNoteInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        try {
            await createNoteFromInput();
        } catch (error) {
            alert(`新增失败：${error.message || '未知错误'}`);
        }
    });

    els.newNoteInput.addEventListener('blur', async () => {
        try {
            await createNoteFromInput();
        } catch (error) {
            alert(`新增失败：${error.message || '未知错误'}`);
        }
    });

    document.addEventListener('click', (event) => {
        if (event.target.closest('.note-row-wrap')) return;
        if (!state.isMetaOpen) return;
        state.isMetaOpen = false;
        render();
    });
}

async function init() {
    bindEvents();
    const ready = await ensureLogin();
    if (!ready) return;
    await refreshNotes();
    setupRealtimeSync();
}

window.addEventListener('beforeunload', teardownRealtimeSync);

LoadingScreen.withLoading(init).catch((error) => {
    console.error(error);
    alert(`小笨笨初始化失败：${error.message || '未知错误'}`);
});
