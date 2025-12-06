import { store } from '../store.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

export default {
    template: `
    <div class="container d-flex align-items-center justify-content-center h-100">
        <div class="card shadow p-4" style="width: 350px;">
            <h4 class="mb-3 text-center">Server Login</h4>
            <div v-if="!store.auth.isSetup" class="text-center mb-3">
                <img :src="store.auth.qrCode" class="img-fluid border p-1 rounded bg-white">
                <div class="small text-muted mt-1">{{ store.auth.secret }}</div>
            </div>
            <input type="text" v-model="store.auth.token" class="form-control text-center mb-3" placeholder="2FA Code" maxlength="6" @keyup.enter="login">
            <button class="btn btn-primary w-100" @click="login">验证</button>
        </div>
    </div>
    `,
    setup() {
        const login = async () => {
            try {
                const res = await api.post('/api/auth/login', { token: store.auth.token });
                if (res.data.success) {
                    store.auth.loggedIn = true;
                    // 登录成功后触发全局初始化事件，或者直接在这里调，为了解耦我们在app.js监听loggedIn
                } else {
                    showToast('验证码错误', 'danger');
                }
            } catch (e) { showToast('请求失败', 'danger'); }
        };
        return { store, login };
    }
};