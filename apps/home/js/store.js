import { supabase } from './supabase.js';
import { Auth } from './auth.js';
import { Calendar } from './calendar.js';

export const Store = {
    items: [],
    inventory: [],
    currentTab: 'gigi',

    async init() {
        await this.loadItems();
        await this.loadInventory();
        this.renderStore();
        this.renderInventory();
    },

    async loadItems() {
        const { data, error } = await supabase
            .from('love_store')
            .select('*')
            .order('id', { ascending: true });

        if (!error) {
            this.items = data;
        }
    },

    async loadInventory() {
        const name = Auth.getMyNickname();
        if (!name) return;

        const { data, error } = await supabase
            .from('user_inventory')
            .select('*')
            .eq('owner_name', name)
            .order('created_at', { ascending: false });

        if (!error) {
            this.inventory = data || [];
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        this.renderStore();

        const btnGigi = document.getElementById('store-tab-gigi');
        const btnGogo = document.getElementById('store-tab-gogo');

        if (tabName === 'gigi') {
            btnGigi.className = 'text-pink-300 font-bold border-b-2 border-pink-400';
            btnGogo.className = 'text-gray-500';
        } else {
            btnGogo.className = 'text-blue-300 font-bold border-b-2 border-blue-400';
            btnGigi.className = 'text-gray-500';
        }
    },

    renderStore() {
        const container = document.getElementById('store-items');
        if (!container) return;
        container.innerHTML = '';

        const filteredItems = this.items.filter(item => {
            const owner = item.owner || '';
            if (this.currentTab === 'gigi') return owner.includes('Gigi');
            return owner.includes('Gogo') || owner.includes('Boy');
        });

        if (filteredItems.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 w-full col-span-2 py-8">这里暂时没有商品哦~<br>快去上架一个吧！</p>`;
            return;
        }

        const iconMap = {
            'heart-beat': '❤️',
            'massage': '💆',
            'drink': '🥤',
            'ticket': '🎫',
            'crown': '👑'
        };

        const myNickname = Auth.getMyNickname();

        filteredItems.forEach(item => {
            const iconKey = item.icon_key || 'heart-beat';
            const iconChar = iconMap[iconKey] || '🎁';
            const animClass = `anim-${iconKey}`;
            const isMyItem = item.owner === myNickname;

            const el = document.createElement('div');
            el.className = 'glass p-4 rounded-2xl flex flex-col items-center justify-between relative overflow-hidden group min-h-[180px]';

            let actionBtn = `
                <button onclick="window.app.buyItem(${item.id})" 
                    class="w-full bg-white/10 hover:bg-pink-500 hover:text-white text-pink-200 text-sm font-bold py-2 rounded-xl transition-all border border-pink-500/20 flex items-center justify-center gap-1">
                    <span>💰</span> ${item.price}
                </button>
            `;

            if (isMyItem) {
                actionBtn = `
                    <button onclick="window.app.deleteItem(${item.id})" 
                        class="w-full bg-red-500/10 hover:bg-red-500 hover:text-white text-red-300 text-sm font-bold py-2 rounded-xl transition-all border border-red-500/20 flex items-center justify-center gap-1">
                        <span>🗑️</span> 下架
                    </button>
                `;
            }

            el.innerHTML = `
                <div class="absolute top-2 right-2 text-[10px] text-gray-500">库存: ${item.stock}</div>
                
                <div class="flex-1 flex items-center justify-center w-full py-2">
                    <div class="text-6xl filter drop-shadow-lg ${animClass} transition-transform duration-300 group-hover:scale-110">
                        ${iconChar}
                    </div>
                </div>
                
                <div class="w-full text-center">
                    <h3 class="font-bold text-md text-white mb-1 truncate w-full">${item.title}</h3>
                    ${actionBtn}
                </div>
            `;
            container.appendChild(el);
        });
    },

    async deleteItem(itemId) {
        if (!confirm('确定要下架这个商品吗？')) return;

        const myNickname = Auth.getMyNickname();
        const { error } = await supabase
            .from('love_store')
            .delete()
            .eq('id', itemId)
            .eq('owner', myNickname);

        if (error) {
            alert('下架失败: ' + error.message);
        } else {
            alert('已下架');
            await this.loadItems();
            this.renderStore();
        }
    },

    renderInventory() {
        const container = document.getElementById('inventory-items');
        if (!container) return;
        container.innerHTML = '';

        if (!this.inventory || this.inventory.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">背包里还没有东西哦~</p>';
            return;
        }

        const active = this.inventory.filter(i => !i.is_used);
        const used = this.inventory.filter(i => i.is_used);

        const renderItem = (item) => {
            const isUsed = item.is_used;
            const el = document.createElement('div');
            el.className = `p-3 rounded-lg border flex justify-between items-center ${isUsed ? 'bg-gray-800/50 border-gray-700 opacity-50' : 'bg-pink-500/10 border-pink-500/30'}`;
            el.innerHTML = `
                <div>
                    <span class="text-sm font-bold ${isUsed ? 'text-gray-400 line-through' : 'text-pink-200'}">${item.item_name}</span>
                    <div class="text-[10px] text-gray-500">${new Date(item.created_at).toLocaleDateString()}</div>
                </div>
                ${!isUsed ? `
                    <button onclick="window.app.useItem('${item.id}', '${item.item_name}')" 
                        class="text-xs bg-pink-500 text-white px-2 py-1 rounded shadow hover:scale-105 transition">
                        使用
                    </button>
                ` : '<span class="text-xs text-gray-500">已核销</span>'}
            `;
            return el;
        };

        active.forEach(item => container.appendChild(renderItem(item)));

        if (used.length > 0) {
            container.appendChild(renderItem(used[0]));

            if (used.length > 1) {
                const hiddenBox = document.createElement('div');
                hiddenBox.className = 'hidden';
                hiddenBox.id = 'used-items-hidden';
                used.slice(1).forEach(item => hiddenBox.appendChild(renderItem(item)));
                container.appendChild(hiddenBox);

                const toggle = document.createElement('button');
                toggle.className = 'w-full text-center text-xs text-gray-500 py-2 hover:text-gray-300 transition';
                toggle.textContent = `展开更多已核销 (${used.length - 1})`;
                toggle.onclick = () => {
                    const box = document.getElementById('used-items-hidden');
                    if (!box) return;
                    const hidden = box.classList.toggle('hidden');
                    toggle.textContent = hidden
                        ? `展开更多已核销 (${used.length - 1})`
                        : '收起已核销';
                };
                container.appendChild(toggle);
            }
        }
    },

    async addItem(title, price, iconKey) {
        const myNickname = Auth.getMyNickname();
        if (!myNickname) return alert('请先登录');

        const { error } = await supabase.from('love_store').insert({
            title: title,
            price: parseInt(price),
            stock: 99,
            owner: myNickname,
            icon_key: iconKey
        });

        if (error) {
            alert('上架失败: ' + error.message);
        } else {
            alert('✨ 上架成功！');
            await this.loadItems();
            this.renderStore();
            return true;
        }
    },

    async buyItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        if (item.stock <= 0) {
            alert('库存不足啦！');
            return;
        }

        const points = Auth.profile?.points || 0;
        if (points < item.price) {
            document.body.classList.add('animate-shake');
            setTimeout(() => document.body.classList.remove('animate-shake'), 500);
            alert('积分不足，攒攒再来吧~');
            return;
        }

        if (!confirm(`确定花费 ${item.price} 积分购买 "${item.title}" 吗？`)) return;

        await Auth.updatePoints(-item.price);
        await supabase.from('love_store').update({ stock: item.stock - 1 }).eq('id', itemId);

        await supabase.from('user_inventory').insert({
            item_name: item.title,
            is_used: false,
            owner_name: Auth.getMyNickname()
        });

        alert('购买成功！已放入背包');
        await this.init();
        document.dispatchEvent(new CustomEvent('points-updated'));
    },

    async useItem(inventoryId, itemName) {
        if (!confirm(`确定要使用 "${itemName}" 吗？对方会在时光轴看到通知。`)) return;

        const { error } = await supabase
            .from('user_inventory')
            .update({ is_used: true })
            .eq('id', inventoryId);

        if (!error) {
            const nickname = Auth.getMyNickname() || '某人';
            await Calendar.addEvent({
                content: `${nickname} 使用了【${itemName}】，请尽快兑现！`,
                type: 'diary',
                mood: 'happy'
            });

            alert('使用成功！对方会在时光轴看到通知~');
            await this.loadInventory();
            this.renderInventory();
        }
    }
};
