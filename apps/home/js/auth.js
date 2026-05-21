import { supabase } from './supabase.js';
import { isSameChinaDay } from '../../shared/china-time.js';

const IDENTITY_MAP = {
    lrx: 'Gogo',
    zjt: 'Gigi'
};

async function sha256(text) {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const Auth = {
    user: null,
    profile: null,

    getMyNickname() {
        if (this.profile?.nickname) return this.profile.nickname;
        if (this.user?.username) return IDENTITY_MAP[this.user.username] || 'Gogo';
        return null;
    },

    _isSameDay(dateStr) {
        if (!dateStr) return false;
        return isSameChinaDay(dateStr, new Date());
    },

    async init() {
        const saved = localStorage.getItem('love-space-auth');
        if (!saved) return false;

        try {
            const authData = JSON.parse(saved);
            if (!this._isSameDay(authData.loginDate)) {
                localStorage.removeItem('love-space-auth');
                return false;
            }

            if (!authData.loggedIn || !authData.username) return false;

            const { data } = await supabase
                .from('user_credentials')
                .select('id, username, nickname')
                .eq('username', authData.username)
                .maybeSingle();

            if (!data) return false;

            this.user = { id: data.id.toString(), username: data.username };
            await this.loadProfile();
            return true;
        } catch (e) {
            localStorage.removeItem('love-space-auth');
            return false;
        }
    },

    _saveSession(extra = {}) {
        localStorage.setItem('love-space-auth', JSON.stringify({
            loggedIn: true,
            loginType: 'password',
            loginDate: new Date().toISOString(),
            nickname: this.profile?.nickname,
            ...extra
        }));
    },

    async loginWithPassword(username, password) {
        if (!username || !password) throw new Error('请选择身份并确认密码');

        const hashed = await sha256(password);
        const { data, error } = await supabase
            .from('user_credentials')
            .select('id, username, nickname')
            .eq('username', username)
            .eq('password_hash', hashed)
            .single();

        if (error || !data) throw new Error('身份或密码不正确');

        this.user = { id: data.id.toString(), username: data.username };
        await this.loadProfile();
        this._saveSession({ username: data.username });
        return { user: this.user, profile: this.profile };
    },

    async loadProfile() {
        const nickname = this.getMyNickname();
        if (!nickname) return;

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('nickname', nickname)
            .maybeSingle();

        if (data) this.profile = data;
    },

    async updatePoints(amount) {
        if (!this.profile) return;
        const nickname = this.profile.nickname || this.getMyNickname();
        if (!nickname) return;

        this.profile.points = (this.profile.points || 0) + amount;

        await supabase
            .from('profiles')
            .update({ points: this.profile.points })
            .eq('nickname', nickname);

        return this.profile.points;
    },

    async logout() {
        localStorage.removeItem('love-space-auth');
        this.user = null;
        this.profile = null;
    }
};
