import { Auth } from '../home/js/auth.js';
import {
    createMemoryAlbumEntry,
    fetchRecentMemoryEntries,
    formatAlbumDate,
    uploadMemoryAlbumImage
} from '../home/js/album-service.js';

const formEl = document.getElementById('album-form');
const publishBtn = document.getElementById('publish-btn');
const fileInput = document.getElementById('photo-file');
const dateInput = document.getElementById('shot-date');
const captionInput = document.getElementById('caption');
const captionCount = document.getElementById('caption-count');
const previewImage = document.getElementById('preview-image');
const previewPlaceholder = document.getElementById('preview-placeholder');
const previewDate = document.getElementById('preview-date');
const previewCaption = document.getElementById('preview-caption');
const submitStatus = document.getElementById('submit-status');
const recentList = document.getElementById('recent-list');
const refreshRecentBtn = document.getElementById('refresh-recent');
const authorBadge = document.getElementById('author-badge');
const loginHint = document.getElementById('login-hint');

let previewObjectUrl = '';
let currentUserKey = '';
let currentAuthorName = '';
let recentObserver = null;

function setStatus(message, type = '') {
    submitStatus.textContent = message;
    submitStatus.classList.remove('is-success', 'is-error');
    if (type) {
        submitStatus.classList.add(type);
    }
}

function cleanupPreviewObjectUrl() {
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = '';
    }
}

function updatePreviewImage(file) {
    cleanupPreviewObjectUrl();

    if (!file) {
        previewImage.removeAttribute('src');
        previewImage.hidden = true;
        previewPlaceholder.hidden = false;
        return;
    }

    previewObjectUrl = URL.createObjectURL(file);
    previewImage.src = previewObjectUrl;
    previewImage.hidden = false;
    previewPlaceholder.hidden = true;
}

function updatePreviewText() {
    const rawDate = dateInput.value;
    const caption = captionInput.value.trim();

    previewDate.textContent = rawDate ? formatAlbumDate(rawDate) : '2026.04.08';
    previewCaption.textContent = caption || '这里会显示你的文字描述。';
    captionCount.textContent = String(captionInput.value.length);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderRecentEntries(entries) {
    if (!entries.length) {
        recentList.innerHTML = '<div class="recent-empty">这里会显示最近写入回忆墙的照片卡，双方登录后都能看到。</div>';
        return;
    }

    recentList.innerHTML = entries.map((entry) => `
        <article class="recent-card">
            <div class="recent-card-media">
                <div class="recent-card-placeholder">加载中...</div>
                <img data-src="${entry.imageUrl}" alt="${escapeHtml(entry.shotDate)}" loading="lazy" decoding="async" fetchpriority="auto">
            </div>
            <div class="recent-card-date">${escapeHtml(entry.shotDate)}</div>
            <div class="recent-card-caption">${escapeHtml(entry.caption)}</div>
        </article>
    `).join('');

    hydrateRecentImages();
}

function hydrateRecentImages() {
    if (recentObserver) {
        recentObserver.disconnect();
    }

    const reveal = (img) => {
        img.classList.add('is-loaded');
        const placeholder = img.previousElementSibling;
        if (placeholder) placeholder.classList.add('is-hidden');
    };

    recentObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            const src = img.dataset.src;
            if (!src) {
                recentObserver.unobserve(img);
                return;
            }

            img.src = src;
            img.removeAttribute('data-src');
            img.addEventListener('load', () => reveal(img), { once: true });
            img.addEventListener('error', () => {
                const placeholder = img.previousElementSibling;
                if (placeholder) {
                    placeholder.textContent = '图片加载失败';
                    placeholder.classList.remove('is-hidden');
                }
            }, { once: true });
            recentObserver.unobserve(img);
        });
    }, { rootMargin: '360px 0px' });

    recentList.querySelectorAll('img[data-src]').forEach((img, index) => {
        if (index < 2) {
            img.setAttribute('fetchpriority', 'high');
        }
        recentObserver.observe(img);
    });
}

async function loadRecentEntries() {
    try {
        const entries = await fetchRecentMemoryEntries();
        renderRecentEntries(entries);
    } catch (error) {
        recentList.innerHTML = `<div class="recent-empty">最近回忆加载失败：${escapeHtml(error.message || '未知错误')}</div>`;
    }
}

function deriveCurrentUserKey() {
    if (Auth.user?.id) return String(Auth.user.id);
    if (Auth.user?.username) return String(Auth.user.username);
    if (Auth.user?.email) return String(Auth.user.email);
    if (Auth.profile?.nickname) return String(Auth.profile.nickname);
    return `guest-${Date.now()}`;
}

async function ensureLogin() {
    const isLoggedIn = await Auth.init();
    if (!isLoggedIn) {
        loginHint.classList.remove('hidden');
        setStatus('当前未登录，正在返回主页...', 'is-error');
        setTimeout(() => {
            window.location.href = '../../';
        }, 700);
        return false;
    }

    currentUserKey = deriveCurrentUserKey();
    currentAuthorName = Auth.getMyNickname() || 'Love Space 用户';
    authorBadge.textContent = `当前贡献者：${currentAuthorName}`;
    return true;
}

async function handleSubmit() {
    const file = fileInput.files?.[0];
    const shotDate = dateInput.value;
    const caption = captionInput.value.trim();
    const maxFileSize = 2 * 1024 * 1024;

    if (!file) {
        setStatus('先选择一张图片再保存。', 'is-error');
        return;
    }
    if (file.size > maxFileSize) {
        setStatus('图片不能超过 2MB，请先压缩后再上传。', 'is-error');
        return;
    }
    if (!shotDate) {
        setStatus('请填写拍摄日期。', 'is-error');
        return;
    }
    if (!caption) {
        setStatus('请补上一句描述。', 'is-error');
        return;
    }

    publishBtn.disabled = true;
    refreshRecentBtn.disabled = true;
    setStatus('正在上传图片并写入回忆墙...');

    try {
        const imagePath = await uploadMemoryAlbumImage(file, currentUserKey);
        await createMemoryAlbumEntry({
            imagePath,
            shotDate,
            caption,
            authorName: currentAuthorName,
            createdBy: currentUserKey,
            isPublished: true
        });

        formEl.reset();
        dateInput.value = new Date().toISOString().slice(0, 10);
        updatePreviewImage(null);
        updatePreviewText();
        setStatus('上传成功，新的回忆卡已经写入。', 'is-success');
        await loadRecentEntries();
    } catch (error) {
        setStatus(`保存失败：${error.message || '未知错误'}`, 'is-error');
    } finally {
        publishBtn.disabled = false;
        refreshRecentBtn.disabled = false;
    }
}

function bindEvents() {
    fileInput.addEventListener('change', () => {
        updatePreviewImage(fileInput.files?.[0] || null);
    });
    dateInput.addEventListener('input', updatePreviewText);
    captionInput.addEventListener('input', updatePreviewText);
    publishBtn.addEventListener('click', handleSubmit);
    refreshRecentBtn.addEventListener('click', loadRecentEntries);
}

async function init() {
    bindEvents();
    dateInput.value = new Date().toISOString().slice(0, 10);
    updatePreviewImage(null);
    updatePreviewText();

    const ready = await ensureLogin();
    if (!ready) return;

    setStatus('等待保存');
    await loadRecentEntries();
}

window.addEventListener('beforeunload', cleanupPreviewObjectUrl);

init().catch((error) => {
    setStatus(`初始化失败：${error.message || '未知错误'}`, 'is-error');
});
