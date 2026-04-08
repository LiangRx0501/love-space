import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Store } from './store.js';
import { Calendar } from './calendar.js';
import { Weather } from './weather.js';
import { initBackground, setWeatherEffect } from './background.js';

const App = {
    _timerInterval: null,
    _inputBound: false,
    _pointsHandler: null,

    async init() {
        console.log('Love Space App Initializing...');
        initBackground();

        if (!this._pointsHandler) {
            this._pointsHandler = () => this.updatePointsDisplay();
            document.addEventListener('points-updated', this._pointsHandler);
        }

        // 检查登录状态
        const isLoggedIn = await Auth.init();

        // 移除 Loading 遮罩
        setTimeout(() => {
            const loader = document.getElementById('loading-overlay');
            if (loader) loader.classList.add('opacity-0', 'pointer-events-none');
        }, 800);

        if (isLoggedIn) {
            this.showPage('main');
        } else {
            this.showPage('auth');
        }
    },

    showPage(pageName) {
        document.getElementById('page-auth').classList.add('hidden');
        document.getElementById('page-main').classList.add('hidden');

        const target = document.getElementById(`page-${pageName}`);
        if (target) target.classList.remove('hidden');

        if (pageName === 'main') {
            this.initMainPage();
        }
    },

    async initMainPage() {
        this.startLoveTimer();
        this.updatePointsDisplay();

        await Calendar.init();
        await Store.init();

        this.initWeather();
        this.bindInputEnter();
    },

    async initWeather() {
        try {
            const weatherType = await Weather.init();
            if (weatherType) {
                console.log('Applying Weather Type:', weatherType);
                setWeatherEffect(weatherType);
            }
        } catch (e) {
            console.log('Weather init failed, keeping default.', e);
        }
    },

    startLoveTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        const start = new Date(CONFIG.ANNIVERSARY_DATE);

        const updateTimer = () => {
            const now = new Date();
            const diff = now - start;

            if (diff >= 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const remainder = diff % (1000 * 60 * 60 * 24);

                const hours = Math.floor(remainder / (1000 * 60 * 60));
                const minutes = Math.floor((remainder % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((remainder % (1000 * 60)) / 1000);

                const dayEl = document.getElementById('timer-days');
                if (dayEl) dayEl.innerText = days;

                this.updateFlipCard('hour', hours);
                this.updateFlipCard('min', minutes);
                this.updateFlipCard('sec', seconds);
            }
        };

        updateTimer();
        this._timerInterval = setInterval(updateTimer, 1000);
    },

    updateFlipCard(type, value) {
        const str = value.toString().padStart(2, '0');
        const tens = str[0];
        const ones = str[1];

        const tensEl = document.getElementById(`${type}-tens`);
        const onesEl = document.getElementById(`${type}-ones`);

        if (tensEl && tensEl.innerText !== tens) {
            this.animateFlip(tensEl, tens);
        }
        if (onesEl && onesEl.innerText !== ones) {
            this.animateFlip(onesEl, ones);
        }
    },

    animateFlip(el, newValue) {
        el.style.transition = "transform 0.3s ease-in";
        el.style.transform = "rotateX(90deg)";

        setTimeout(() => {
            el.innerText = newValue;
            el.style.transition = "transform 0.3s ease-out";
            el.style.transform = "rotateX(0deg)";
        }, 300);
    },

    bindInputEnter() {
        if (this._inputBound) return;
        const input = document.getElementById('new-diary');
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendDiary();
            }
        });
        this._inputBound = true;
    },

    updatePointsDisplay() {
        const el = document.getElementById('user-points');
        if (el && Auth.profile) {
            el.innerText = `💰 ${Auth.profile.points || 0}`;
        }
    },

    switchTab(tab) {
        document.getElementById('view-timeline').classList.add('hidden');
        document.getElementById('view-calendar-grid').classList.add('hidden');
        document.getElementById('view-store').classList.add('hidden');

        const buttons = ['tab-btn-timeline', 'tab-btn-calendar-grid', 'tab-btn-store'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('bg-pink-500', 'text-white');
                btn.classList.add('text-gray-400');
            }
        });

        const targetView = document.getElementById(`view-${tab}`);
        const targetBtn = document.getElementById(`tab-btn-${tab}`);

        if (targetView) targetView.classList.remove('hidden');
        if (targetBtn) {
            targetBtn.classList.remove('text-gray-400');
            targetBtn.classList.add('bg-pink-500', 'text-white');
        }

        if (tab === 'calendar-grid') {
            Calendar.renderCalendarGrid();
        }
    },

    switchLoginMode(mode) {
        const emailGroup = document.getElementById('login-email-group');
        const passwordGroup = document.getElementById('login-password-group');
        const btnEmail = document.getElementById('login-mode-email');
        const btnPassword = document.getElementById('login-mode-password');

        if (mode === 'email') {
            emailGroup.classList.remove('hidden');
            passwordGroup.classList.add('hidden');
            btnEmail.classList.add('bg-pink-500', 'text-white');
            btnEmail.classList.remove('text-gray-400');
            btnPassword.classList.remove('bg-pink-500', 'text-white');
            btnPassword.classList.add('text-gray-400');
        } else {
            passwordGroup.classList.remove('hidden');
            emailGroup.classList.add('hidden');
            btnPassword.classList.add('bg-pink-500', 'text-white');
            btnPassword.classList.remove('text-gray-400');
            btnEmail.classList.remove('bg-pink-500', 'text-white');
            btnEmail.classList.add('text-gray-400');
        }
    },

    async loginWithPassword() {
        const username = document.getElementById('input-username').value.trim();
        const password = document.getElementById('input-password').value.trim();

        try {
            await Auth.loginWithPassword(username, password);
            this.showPage('main');
        } catch (e) {
            alert(e.message);
        }
    },

    async sendMagicCode(e) {
        const email = document.getElementById('input-email').value;
        const btn = e ? e.target : document.querySelector('#step-email button');

        try {
            btn.innerText = "发送中...";
            btn.disabled = true;
            await Auth.sendMagicCode(email);

            document.getElementById('step-email').classList.add('hidden');
            document.getElementById('step-otp').classList.remove('hidden');
            alert('✅ 验证码已发送到 QQ 邮箱！');
        } catch (err) {
            alert('发送失败: ' + err.message);
            btn.innerText = "获取通行证";
            btn.disabled = false;
        }
    },

    async verifyCode() {
        const token = document.getElementById('input-otp').value;
        try {
            await Auth.verifyCode(token);

            if (!Auth.profile || !Auth.profile.nickname) {
                document.getElementById('step-otp').classList.add('hidden');
                document.getElementById('step-profile').classList.remove('hidden');
            } else {
                this.showPage('main');
            }
        } catch (e) {
            alert('验证失败: ' + e.message);
        }
    },

    async saveProfile() {
        const nickname = document.getElementById('input-nickname').value;
        try {
            await Auth.saveProfile(nickname);
            this.showPage('main');
        } catch (e) {
            alert('保存失败: ' + e.message);
        }
    },

    async logout() {
        if (!confirm('确定要退出登录吗？')) return;
        await Auth.logout();
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        this._inputBound = false;
        this.showPage('auth');
    },

    async sendDiary() {
        const input = document.getElementById('new-diary');
        const content = input.value;
        const moodSelect = document.getElementById('mood-select');
        const mood = moodSelect ? moodSelect.value : null;

        if (!content && !mood) return;

        // Command: trigger birthday overlay without writing the keyword into chat history.
        const trimmed = (content || '').trim();
        if (trimmed === '生日') {
            if (typeof window.triggerBirthday === 'function') {
                window.triggerBirthday();
            }
            input.value = '';
            if (moodSelect) moodSelect.value = '';
            return;
        }

        if (content && content.includes('游戏')) {
            const isRoot = !window.location.pathname.includes('/apps/home');
            window.location.href = isRoot ? './apps/game/' : '../game/';
            return;
        }

        await Calendar.addEvent({ content, mood });
        input.value = '';
        if (moodSelect) moodSelect.value = '';
    },

    doCheckIn: () => Calendar.doCheckIn(),
    sootheUser: (id) => Calendar.sootheUser(id),
    changeMonth: (offset) => Calendar.changeMonth(offset),
    closeDateModal: () => Calendar.closeDateModal(),
    toggleScheduleForm: () => Calendar.toggleScheduleForm(),
    addSchedule: () => Calendar.addSchedule(),
    completeSchedule: (id) => Calendar.completeSchedule(id),

    buyItem: (id) => Store.buyItem(id),
    useItem: (id, name) => Store.useItem(id, name),
    switchStoreTab: (tab) => Store.switchTab(tab),
    deleteItem: (id) => Store.deleteItem(id),

    openAddItemModal() {
        document.getElementById('add-item-modal').classList.remove('hidden');
    },
    closeAddItemModal() {
        document.getElementById('add-item-modal').classList.add('hidden');
    },
    selectIcon(iconKey) {
        document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('icon-selected'));
        const selectedEl = document.querySelector(`.icon-option[data-value="${iconKey}"]`);
        if (selectedEl) selectedEl.classList.add('icon-selected');

        document.getElementById('new-item-icon').value = iconKey;
    },
    async saveNewItem() {
        const title = document.getElementById('new-item-title').value;
        const price = document.getElementById('new-item-price-range').value;
        const iconKey = document.getElementById('new-item-icon').value;

        if (!title) return alert('请填写商品名称');

        const success = await Store.addItem(title, price, iconKey);
        if (success) {
            this.closeAddItemModal();
            document.getElementById('new-item-title').value = '';
        }
    },

    toggleMoodPanel() {
        const panel = document.getElementById('mood-panel');
        panel.classList.toggle('hidden');
    },

    sendSOS(moodType) {
        const contentMap = {
            'angry': '我现在很生气！😠',
            'sad': '我好难过... 😭',
            'sos': '紧急求救！需要抱抱！🆘'
        };

        Calendar.addEvent({
            content: contentMap[moodType],
            type: 'diary',
            mood: moodType
        });

        document.getElementById('mood-panel').classList.add('hidden');
    }
};

window.app = App;

window.onload = () => App.init();
