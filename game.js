const CONFIG = { DAY_LENGTH_SEC: 60, RENT_BASE: 50, RENT_GROWTH: 20, MAX_TABLES: 7 };
const CHAR_TYPES = {
    ADVENTURER: { name: '冒险者', types: ['落魄剑士', '新手牧师', '高傲法师', '老练猎人', '重装骑士'] },
    MONSTER: { name: '怪物', types: ['绿皮哥布林', '岩石史莱姆', '独眼巨魔', '骷髅兵', '魅魔'] },
    MYSTERIOUS: { name: '神秘人', types: ['黑市商人', '流浪诗人', '深渊凝视者'] }
};
const STORIES = {
    joy: [
        '一位[角色1]和[角色2]分享了战利品，两人哈哈大笑。',
        '[角色1]喝醉了，跳了一支滑稽的舞，酒馆里充满了快活的空气。',
        '[角色1]找到了失散多年的战友，两人相拥而泣。',
        '“敬这该死的地下城！”[角色1]举起酒杯大喊。',
        '[角色1]给了一笔慷慨的小费，因为这里的烤肉让他想起了家乡。'
    ],
    sorrow: [
        '[角色1]默默喝完最后一口酒，留下沾血的铭牌，走向了下层迷宫。',
        '角落里，[角色1]一直在低声哭泣，似乎刚刚失去了队伍。',
        '一杯苦酒下肚，[角色1]喃喃自语：“再也回不去了……”',
        '[角色1]呆呆地看着空桌对面的座位，那里曾经坐着他的挚友。',
        '一封未寄出的信被[角色1]遗忘在桌上，上面写满歉意。'
    ],
    fight: [
        '[角色1]指责[角色2]出老千，两人大打出手！砸坏了酒杯。',
        '因为一个眼神，[角色1]和[角色2]拔出了武器，吓跑了旁边的客人。',
        '[角色1]喝多了，竟然试图调戏[角色2]，结果被揍得鼻青脸肿。',
        '两桌客人因为信仰不同发生了械斗，酒馆名声受损！'
    ]
};

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randItem(items) { return items[Math.floor(Math.random() * items.length)]; }

let world;
try {
    world = TavernArt.create();
} catch (error) {
    document.getElementById('modal-desc').textContent = '炉火未能点亮。请检查网络，并使用支持 WebGL 的浏览器重试。';
    document.getElementById('btn-start').textContent = '重新点亮炉火';
    document.getElementById('btn-start').onclick = () => location.reload();
    throw error;
}
const { scene, camera, renderer } = world;

class Seat {
    constructor(positionX, positionZ, tableId, tableX, tableZ) {
        this.x = positionX;
        this.z = positionZ;
        this.tableId = tableId;
        this.isOccupied = false;
        this.customer = null;
        this.rotation = Math.atan2(tableX - positionX, tableZ - positionZ);
        TavernArt.chair(positionX, positionZ, tableX, tableZ);
    }
}

class Customer {
    constructor(id) {
        this.id = id;
        const chance = Math.random();
        const mysteryChance = game.buffDrink ? .8 : .9;
        this.categoryKey = chance < .45 ? 'ADVENTURER' : chance < mysteryChance ? 'MONSTER' : 'MYSTERIOUS';
        this.category = CHAR_TYPES[this.categoryKey];
        this.name = randItem(this.category.types);
        this.state = 'ENTER';
        this.targetSeat = null;
        this.drinkTime = randInt(10, 30);
        this.timer = 0;
        this.walkTime = Math.random() * 5;
        this.mesh = TavernArt.character(this.categoryKey, this.name);
        this.mesh.position.set(7.8, 0, 11.8);
        this.mesh.userData.customer = this;
        scene.add(this.mesh);
    }

    update(delta) {
        const speed = 4 * delta;
        TavernArt.animateCharacter(this.mesh, this.state, this.state === 'DRINKING' ? this.timer : this.walkTime / 10);
        if (this.state === 'ENTER') {
            const emptySeats = game.seats.filter(seat => !seat.isOccupied);
            if (emptySeats.length) {
                this.targetSeat = randItem(emptySeats);
                this.targetSeat.isOccupied = true;
                this.targetSeat.customer = this;
                this.state = 'SEEK_SEAT';
            } else {
                game.showEmoji(this.mesh, '满座');
                game.addLog(`${this.name}发现没有空位，骂骂咧咧地走了。`, 'sys');
                this.state = 'LEAVING';
            }
            game.updateOccupancy();
        } else if (this.state === 'SEEK_SEAT' || this.state === 'LEAVING') {
            const targetX = this.state === 'SEEK_SEAT' ? this.targetSeat.x : 7.8;
            const targetZ = this.state === 'SEEK_SEAT' ? this.targetSeat.z : 13.5;
            const distanceX = targetX - this.mesh.position.x;
            const distanceZ = targetZ - this.mesh.position.z;
            this.walkTime += delta * 10;
            this.mesh.userData.body.rotation.z = Math.sin(this.walkTime) * .055;
            this.mesh.userData.body.position.y = Math.abs(Math.sin(this.walkTime)) * .07;
            if (Math.abs(distanceX) > .05) {
                this.mesh.rotation.y = Math.sign(distanceX) * Math.PI / 2;
                this.mesh.position.x += Math.sign(distanceX) * Math.min(speed, Math.abs(distanceX));
            } else if (Math.abs(distanceZ) > .05) {
                this.mesh.rotation.y = distanceZ > 0 ? 0 : Math.PI;
                this.mesh.position.z += Math.sign(distanceZ) * Math.min(speed, Math.abs(distanceZ));
            } else {
                this.mesh.userData.body.rotation.z = 0;
                this.mesh.userData.body.position.y = 0;
                if (this.state === 'SEEK_SEAT') {
                    this.mesh.rotation.y = this.targetSeat.rotation;
                    this.state = 'DRINKING';
                    game.showEmoji(this.mesh, '麦酒一杯');
                } else this.destroy();
            }
        } else if (this.state === 'DRINKING') {
            this.timer += delta;
            if (Math.random() < 1 - Math.exp(-.3 * delta)) this.triggerRandomEvent();
            if (this.timer > this.drinkTime) {
                this.payBill();
                this.state = 'LEAVING';
                this.targetSeat.isOccupied = false;
                this.targetSeat.customer = null;
                this.targetSeat = null;
                game.updateOccupancy();
            }
        }
    }

    triggerRandomEvent() {
        const chance = Math.random();
        if (chance < .3) {
            game.showEmoji(this.mesh, '一杯苦酒');
            game.addLog(randItem(STORIES.sorrow).replace('[角色1]', this.name), 'sorrow');
        } else if (chance < .6) {
            game.showEmoji(this.mesh, '敬此刻 +2G');
            game.addLog(randItem(STORIES.joy).replace('[角色1]', this.name).replace('[角色2]', '某人'), 'joy');
            game.updateStats(2, 1);
        } else if (chance < .8 && this.targetSeat) {
            const neighbor = game.seats.find(seat => seat.tableId === this.targetSeat.tableId && seat !== this.targetSeat && seat.isOccupied && seat.customer.state === 'DRINKING');
            if (neighbor) {
                game.showEmoji(this.mesh, '争执！');
                game.showEmoji(neighbor.customer.mesh, '名声 −5');
                game.addLog(randItem(STORIES.fight).replace('[角色1]', this.name).replace('[角色2]', neighbor.customer.name), 'fight');
                game.updateStats(0, -5);
            }
        }
    }

    payBill() {
        let payment = randInt(5, 15);
        if (this.categoryKey === 'MYSTERIOUS') payment += 20;
        if (game.buffDrink) payment = Math.floor(payment * 1.5);
        game.updateStats(payment, 1);
        game.showEmoji(this.mesh, `+${payment} G`);
    }

    destroy() {
        scene.remove(this.mesh);
        TavernArt.disposeCharacter(this.mesh);
        game.customers = game.customers.filter(customer => customer !== this);
    }
}

const game = {
    isRunning: false,
    hasStarted: false,
    isPaused: false,
    isOver: false,
    gold: 100,
    rep: 50,
    day: 1,
    timeAcc: 0,
    customers: [],
    seats: [],
    tables: [],
    customerIdCounter: 0,
    spawnTimer: 0,
    buffDrink: false,
    tablePositions: [{ x: 6, z: 0 }, { x: -6, z: -4 }, { x: 6, z: -4 }, { x: -6, z: 8 }, { x: 0, z: 8 }],

    init() {
        this.addTable(0, 0);
        this.addTable(-6, 4);
        this.updateUI();
        this.addLog('欢迎来到深渊之末。为每一个疲惫的旅人，留一盏灯。', 'sys');
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-buy-table').addEventListener('click', () => this.buyTable());
        document.getElementById('btn-buy-drink').addEventListener('click', () => this.buyGoodDrink());
        document.getElementById('btn-clean').addEventListener('click', () => this.cleanTavern());
        document.getElementById('btn-pause').addEventListener('click', () => this.pause());
        document.getElementById('btn-journal').addEventListener('click', () => {
            const isOpen = document.getElementById('journal').classList.toggle('open');
            document.getElementById('btn-journal').setAttribute('aria-expanded', String(isOpen));
        });
        window.addEventListener('keydown', event => {
            if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button, input, textarea, select, [contenteditable]')) return;
            if (event.code === 'Space' && this.hasStarted && !this.isOver) {
                event.preventDefault();
                this.pause();
            } else if (event.key === '1') this.buyTable();
            else if (event.key === '2') this.buyGoodDrink();
            else if (event.key === '3') this.cleanTavern();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning) this.pause(true);
        });
    },

    start() {
        if (this.isOver) return location.reload();
        document.getElementById('modal').style.display = 'none';
        document.body.classList.remove('intro');
        this.hasStarted = true;
        this.isRunning = true;
        this.addLog('木门推开，麦酒满上。今天的故事开始了。', 'sys');
        this.updateUI();
        document.getElementById('btn-start').blur();
    },

    pause(force) {
        if (!this.hasStarted || this.isOver) return;
        this.isPaused = typeof force === 'boolean' ? force : !this.isPaused;
        this.isRunning = !this.isPaused;
        document.body.classList.toggle('paused', this.isPaused);
        document.getElementById('btn-pause').setAttribute('aria-label', this.isPaused ? '继续营业' : '暂停营业');
        document.querySelector('#btn-pause use').setAttribute('href', this.isPaused ? '#icon-play' : '#icon-pause');
        this.updateUI();
    },

    gameOver(reason) {
        this.isRunning = false;
        this.isOver = true;
        hoverLabel.style.display = 'none';
        document.body.classList.remove('paused');
        document.body.classList.add('intro');
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('modal-title').textContent = '炉火暂熄';
        document.getElementById('modal-title').style.color = 'var(--danger)';
        document.getElementById('modal-desc').textContent = `${reason} 你守住了 ${this.day} 天的炉火。歇一歇，再为深渊点一盏灯吧。`;
        document.querySelector('#btn-start span').textContent = '重新点亮炉火';
        this.updateUI();
        document.getElementById('btn-start').focus();
    },

    addTable(positionX, positionZ) {
        const tableId = this.tables.length;
        const mesh = TavernArt.table(positionX, positionZ);
        this.tables.push({ id: tableId, x: positionX, z: positionZ, mesh });
        this.seats.push(
            new Seat(positionX - 1.65, positionZ, tableId, positionX, positionZ),
            new Seat(positionX + 1.65, positionZ, tableId, positionX, positionZ),
            new Seat(positionX, positionZ - 1.65, tableId, positionX, positionZ),
            new Seat(positionX, positionZ + 1.65, tableId, positionX, positionZ)
        );
        renderer.shadowMap.needsUpdate = true;
        this.updateOccupancy();
    },

    buyTable() {
        if (!this.isRunning || this.gold < 50 || this.tables.length >= CONFIG.MAX_TABLES) return;
        const position = this.tablePositions[this.tables.length - 2];
        this.addTable(position.x, position.z);
        TavernArt.feedback([position.x, 1.6, position.z], 0xe5c58b, 24);
        this.updateStats(-50, 0);
        this.addLog('新桌椅搬进了酒馆，又能多留四位旅人。', 'sys');
    },

    buyGoodDrink() {
        if (!this.isRunning || this.gold < 30 || this.buffDrink) return;
        this.buffDrink = true;
        this.updateStats(-30, 0);
        TavernArt.feedback([-3.4, 2.8, -8], 0x9ac4aa, 22);
        this.addLog('精灵麦酒已经开桶。今夜的客人，会出手更大方。', 'joy');
    },

    cleanTavern() {
        if (!this.isRunning || this.gold < 10) return;
        this.updateStats(-10, 5);
        this.tables.forEach(table => TavernArt.feedback([table.x, .7, table.z], 0xc0dcd6, 10));
        this.addLog('擦去旧酒渍，扫净碎玻璃。酒馆又有了家的样子。', 'sys');
    },

    updateStats(goldChange, repChange) {
        this.gold += goldChange;
        this.rep = Math.min(100, this.rep + repChange);
        this.updateUI();
        if (this.rep <= 0 && !this.isOver) this.gameOver('酒馆恶名远扬，再也没有人敢来了。');
    },

    updateOccupancy() {
        const occupied = this.seats.filter(seat => seat.isOccupied).length;
        document.getElementById('world-status').textContent = `${occupied ? '旅人落座' : '炉火已燃'} · ${occupied} / ${this.seats.length} 客座`;
    },

    updateUI() {
        document.getElementById('ui-gold').textContent = this.gold;
        document.getElementById('ui-rep').textContent = this.rep;
        document.getElementById('ui-day').textContent = this.day;
        document.getElementById('ui-rent').textContent = CONFIG.RENT_BASE + (this.day - 1) * CONFIG.RENT_GROWTH;
        document.getElementById('ui-gold').style.color = this.gold < 50 ? 'var(--danger)' : 'var(--gold)';
        document.getElementById('ui-rep').style.color = this.rep < 30 ? 'var(--danger)' : 'var(--paper)';
        document.getElementById('btn-buy-table').disabled = !this.isRunning || this.gold < 50 || this.tables.length >= CONFIG.MAX_TABLES;
        document.getElementById('btn-buy-drink').disabled = !this.isRunning || this.gold < 30 || this.buffDrink;
        document.getElementById('btn-clean').disabled = !this.isRunning || this.gold < 10;
        document.getElementById('table-hint').textContent = this.tables.length >= CONFIG.MAX_TABLES ? '酒馆桌椅已满' : '增加 4 个客座';
        document.getElementById('drink-hint').textContent = this.buffDrink ? '麦酒供应中' : '本日小费 +50%';
        document.getElementById('ui-buff').style.display = this.buffDrink ? 'block' : 'none';
    },

    addLog(text, type) {
        const message = document.createElement('div');
        message.className = `log-msg log-${type}`;
        const timestamp = document.createElement('span');
        timestamp.className = 'log-time';
        timestamp.textContent = this.formatTime();
        message.append(timestamp, document.createTextNode(text));
        const panel = document.getElementById('log-panel');
        panel.appendChild(message);
        while (panel.children.length > 80) panel.firstElementChild.remove();
        panel.scrollTop = panel.scrollHeight;
        document.getElementById('log-preview').textContent = text;
    },

    formatTime() {
        const ratio = Math.min(1, this.timeAcc / CONFIG.DAY_LENGTH_SEC);
        const hour = Math.floor(8 + ratio * 16);
        const minute = Math.floor((ratio * 16 * 60) % 60);
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    },

    showEmoji(mesh, text) {
        if (mesh.userData.bubble) mesh.userData.bubble.remove();
        const bubbles = document.querySelectorAll('.floating-emoji');
        if (bubbles.length >= 8) bubbles[0].remove();
        const position = mesh.position.clone();
        position.y += 3;
        position.project(camera);
        const element = document.createElement('div');
        element.className = 'floating-emoji';
        element.textContent = text;
        element.style.left = `${(position.x * .5 + .5) * window.innerWidth}px`;
        element.style.top = `${(position.y * -.5 + .5) * window.innerHeight}px`;
        document.body.appendChild(element);
        mesh.userData.bubble = element;
        setTimeout(() => element.remove(), 2000);
    },

    endDay() {
        const rent = CONFIG.RENT_BASE + (this.day - 1) * CONFIG.RENT_GROWTH;
        this.addLog(`第 ${this.day} 夜，收税官带走了 ${rent} 金币的地租。`, 'sorrow');
        this.updateStats(-rent, 0);
        if (this.gold < 0) return this.gameOver('钱袋已空，无法支付地下城的地租。');
        this.day++;
        this.timeAcc = 0;
        this.buffDrink = false;
        this.addLog(`第 ${this.day} 天，炉火未熄，酒馆照常营业。`, 'sys');
        this.updateUI();
    },

    tick(delta) {
        if (!this.isRunning) return;
        this.timeAcc += delta;
        document.getElementById('ui-time').textContent = this.formatTime();
        document.getElementById('day-progress').style.width = `${Math.min(100, this.timeAcc / CONFIG.DAY_LENGTH_SEC * 100)}%`;
        if (this.timeAcc >= CONFIG.DAY_LENGTH_SEC) {
            this.endDay();
            if (!this.isRunning) return;
        }
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            if (this.customers.length < this.seats.length + 3) this.customers.push(new Customer(this.customerIdCounter++));
            this.spawnTimer = Math.max(1, 6 - this.rep / 20) + Math.random() * 2;
        }
        for (const customer of [...this.customers]) {
            if (!this.isRunning) break;
            customer.update(delta);
        }
        if (this.customers.length) renderer.shadowMap.needsUpdate = true;
    }
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const hoverLabel = document.getElementById('hover-label');
renderer.domElement.addEventListener('pointermove', event => {
    if (!game.hasStarted || game.isOver) return;
    pointer.set(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(game.customers.map(customer => customer.mesh), true);
    if (!hits.length) {
        hoverLabel.style.display = 'none';
        return;
    }
    let object = hits[0].object;
    while (object && !object.userData.customer) object = object.parent;
    if (!object) return;
    const customer = object.userData.customer;
    hoverLabel.replaceChildren(document.createTextNode(customer.name));
    const description = document.createElement('small');
    description.textContent = `${customer.category.name} · ${customer.state === 'DRINKING' ? '享用麦酒中' : '路过的旅人'}`;
    hoverLabel.appendChild(description);
    hoverLabel.style.display = 'block';
    hoverLabel.style.left = `${Math.min(window.innerWidth - hoverLabel.offsetWidth - 12, event.clientX + 14)}px`;
    hoverLabel.style.top = `${Math.min(window.innerHeight - hoverLabel.offsetHeight - 12, event.clientY + 14)}px`;
});
renderer.domElement.addEventListener('pointerleave', () => { hoverLabel.style.display = 'none'; });

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), .1);
    game.tick(delta);
    TavernArt.update(delta, game.timeAcc / CONFIG.DAY_LENGTH_SEC, !game.hasStarted);
    renderer.render(scene, camera);
}
game.init();
animate();
