import { supabase } from './supabase.js';

const IDENTITY_MAP = {
    password: { lrx: 'Gogo', zjt: 'Gigi' },
    email: {
        'd24091110122@cityu.edu.mo': 'Gogo',
        'h24091115075@cityu.edu.mo': 'Gigi'
    }
};

const PASSWORD_EMAIL = {
    lrx: 'd24091110122@cityu.edu.mo',
    zjt: 'h24091115075@cityu.edu.mo'
};

async function sha256(text) {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const Auth = {
    user: null,
    profile: null,
    currentEmail: '',
    isPasswordLogin: false,

    _getEmail() {
        if (this.isPasswordLogin && this.user?.username) {
            return PASSWORD_EMAIL[this.user.username];
        }
        return this.user?.email;
    },

    getMyNickname() {
        if (this.profile?.nickname) return this.profile.nickname;
        if (this.isPasswordLogin && this.user?.username) {
            return IDENTITY_MAP.password[this.user.username] || 'Gogo';
        }
        if (this.user?.email) {
            return IDENTITY_MAP.email[this.user.email] || 'Gigi';
        }
        return null;
    },

    _isSameDay(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr).toDateString() === new Date().toDateString();
    },

    async init() {
        const saved = localStorage.getItem('love-space-auth');
        if (saved) {
            try {
                const authData = JSON.parse(saved);

                if (!this._isSameDay(authData.loginDate)) {
                    localStorage.removeItem('love-space-auth');
                    return false;
                }

                if (authData.loggedIn && authData.loginType === 'password') {
                    const { data } = await supabase
                        .from('user_credentials')
                        .select('id, username, nickname')
                        .eq('username', authData.username)
                        .single();

                    if (data) {
                        this.isPasswordLogin = true;
                        this.user = { id: data.id.toString(), username: data.username };
                        await this.loadProfile();
                        return true;
                    }
                }

                if (authData.loggedIn && authData.loginType === 'otp') {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        this.user = session.user;
                        await this.loadProfile();
                        return true;
                    }
                }
            } catch (e) {
                localStorage.removeItem('love-space-auth');
            }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.user = session.user;
            await this.loadProfile();
            this._saveSession('otp');
            return true;
        }
        return false;
    },

    _saveSession(loginType, extra = {}) {
        localStorage.setItem('love-space-auth', JSON.stringify({
            loggedIn: true,
            loginType,
            loginDate: new Date().toISOString(),
            nickname: this.profile?.nickname,
            ...extra
        }));
    },

    async loginWithPassword(username, password) {
        if (!username || !password) throw new Error('请填写账号和密码');

        const hashed = await sha256(password);
        const { data, error } = await supabase
            .from('user_credentials')
            .select('id, username, nickname')
            .eq('username', username)
            .eq('password_hash', hashed)
            .single();

        if (error || !data) throw new Error('账号或密码错误');

        this.isPasswordLogin = true;
        this.user = { id: data.id.toString(), username: data.username };
        await this.loadProfile();

        this._saveSession('password', { username: data.username });
        return { user: this.user, profile: this.profile };
    },

    async sendMagicCode(email) {
        if (!email) throw new Error('请填写邮箱');
        this.currentEmail = email;
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        return true;
    },

    async verifyCode(token) {
        if (!token) throw new Error('请输入验证码');
        const { data, error } = await supabase.auth.verifyOtp({
            email: this.currentEmail,
            token: token,
            type: 'email'
        });

        if (error) throw error;

        this.user = data.user;
        await this.loadProfile();
        this._saveSession('otp');

        return { user: this.user, profile: this.profile };
    },

    async loadProfile() {
        const email = this._getEmail();
        if (!email) return;
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        if (data) this.profile = data;
    },

    async saveProfile(nickname) {
        if (!nickname) return;
        const email = this._getEmail();
        if (!email) return;

        const { error } = await supabase
            .from('profiles')
            .update({ nickname })
            .eq('email', email);

        if (!error) {
            this.profile = { ...this.profile, nickname };
        } else {
            throw error;
        }
    },

    async updatePoints(amount) {
        if (!this.profile) return;
        const email = this._getEmail();
        if (!email) return;

        this.profile.points = (this.profile.points || 0) + amount;

        await supabase
            .from('profiles')
            .update({ points: this.profile.points })
            .eq('email', email);

        return this.profile.points;
    },

    async logout() {
        localStorage.removeItem('love-space-auth');
        if (!this.isPasswordLogin) {
            await supabase.auth.signOut();
        }
        this.user = null;
        this.profile = null;
        this.isPasswordLogin = false;
        this.currentEmail = '';
    }
};
