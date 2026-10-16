const TavernArt = (() => {
    const palette = {
        stone: 0x4c5558, mortar: 0x333c40, darkWood: 0x382920,
        wood: 0x795332, edge: 0x4a3325, oak: 0xad7c45, brass: 0xba914e,
        plaster: 0x9c927b, cream: 0xd8c6a0, teal: 0x355c5a, coal: 0x242c30
    };
    const materials = new Map();
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
    const flameObjects = [];
    const lamps = [];
    const particles = [];
    const decorativeGuests = [];
    const glows = [];
    const bursts = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene, camera, renderer, envGroup, fireLight, moonLight, cameraTarget;
    let elapsed = 0;
    let seed = 147;

    function random() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    function material(color, emission = 0) {
        const key = `${color}:${emission}`;
        if (!materials.has(key)) {
            materials.set(key, new THREE.MeshStandardMaterial({
                color: new THREE.Color(color).convertSRGBToLinear(), roughness: .91, flatShading: true,
                emissive: new THREE.Color(emission ? color : 0x000000).convertSRGBToLinear(), emissiveIntensity: emission
            }));
        }
        return materials.get(key);
    }

    function box(parent, size, position, color, rotation = 0, emission = 0) {
        const mesh = new THREE.Mesh(cube, material(color, emission));
        mesh.scale.set(...size);
        mesh.position.set(...position);
        mesh.rotation.y = rotation;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }

    function round(parent, radius, height, position, color, rotation = null) {
        const mesh = new THREE.Mesh(cylinder, material(color));
        mesh.scale.set(radius, height, radius);
        mesh.position.set(...position);
        if (rotation) mesh.rotation.set(...rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }

    function bakeGroup(group) {
        group.updateMatrixWorld(true);
        const inverse = group.matrixWorld.clone().invert();
        const buckets = new Map();
        const sourceMeshes = [];
        group.traverse(object => {
            if (!object.isMesh || object.userData.animated) return;
            const geometry = object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
            const unindexed = geometry.index ? geometry.toNonIndexed() : geometry;
            if (geometry !== unindexed) geometry.dispose();
            if (!buckets.has(object.material)) buckets.set(object.material, []);
            buckets.get(object.material).push(unindexed);
            sourceMeshes.push(object);
        });
        sourceMeshes.forEach(mesh => mesh.parent.remove(mesh));
        buckets.forEach((geometries, meshMaterial) => {
            const merged = new THREE.BufferGeometry();
            ['position', 'normal', 'uv'].forEach(name => {
                const length = geometries.reduce((total, geometry) => total + geometry.attributes[name].array.length, 0);
                const array = new Float32Array(length);
                let offset = 0;
                geometries.forEach(geometry => {
                    array.set(geometry.attributes[name].array, offset);
                    offset += geometry.attributes[name].array.length;
                });
                merged.setAttribute(name, new THREE.BufferAttribute(array, name === 'uv' ? 2 : 3));
            });
            geometries.forEach(geometry => geometry.dispose());
            merged.computeBoundingSphere();
            const mesh = new THREE.Mesh(merged, meshMaterial);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
        });
    }

    function bottle(parent, position, color, scale = 1) {
        const [positionX, positionY, positionZ] = position;
        round(parent, .13 * scale, .48 * scale, [positionX, positionY + .24 * scale, positionZ], color);
        round(parent, .065 * scale, .21 * scale, [positionX, positionY + .57 * scale, positionZ], color);
        box(parent, [.2 * scale, .17 * scale, .24 * scale], [positionX, positionY + .25 * scale, positionZ], palette.cream);
        round(parent, .07 * scale, .08 * scale, [positionX, positionY + .71 * scale, positionZ], palette.oak);
    }

    function mug(parent, position, scale = 1) {
        const [positionX, positionY, positionZ] = position;
        round(parent, .17 * scale, .32 * scale, [positionX, positionY + .16 * scale, positionZ], palette.oak);
        round(parent, .15 * scale, .04 * scale, [positionX, positionY + .34 * scale, positionZ], 0xeee0b9);
        box(parent, [.12 * scale, .19 * scale, .09 * scale], [positionX + .2 * scale, positionY + .18 * scale, positionZ], palette.brass);
        round(parent, .18 * scale, .05 * scale, [positionX, positionY + .03 * scale, positionZ], palette.brass);
    }

    function candle(parent, position, scale = 1) {
        const [positionX, positionY, positionZ] = position;
        round(parent, .18 * scale, .06 * scale, [positionX, positionY + .03 * scale, positionZ], palette.brass);
        round(parent, .07 * scale, .35 * scale, [positionX, positionY + .22 * scale, positionZ], palette.cream);
        const flame = box(parent, [.09 * scale, .18 * scale, .09 * scale], [positionX, positionY + .46 * scale, positionZ], 0xffc36b, 0, 1.8);
        flame.userData.animated = true;
        flameObjects.push({ mesh: flame, height: .18 * scale, phase: random() * 7 });
    }

    function barrel(parent, position, scale = 1, sideways = false) {
        const group = new THREE.Group();
        parent.add(group);
        const [positionX, positionY, positionZ] = position;
        group.position.set(positionX, positionY, positionZ);
        if (sideways) group.rotation.z = Math.PI / 2;
        round(group, .58 * scale, 1.3 * scale, [0, .65 * scale, 0], palette.wood);
        round(group, .61 * scale, .13 * scale, [0, .2 * scale, 0], palette.coal);
        round(group, .61 * scale, .13 * scale, [0, 1.08 * scale, 0], palette.coal);
        round(group, .51 * scale, .05 * scale, [0, 1.32 * scale, 0], palette.oak);
        for (let segment = 0; segment < 8; segment++) {
            const angle = segment / 8 * Math.PI * 2;
            box(group, [.045 * scale, 1.25 * scale, .07 * scale], [Math.sin(angle) * .56 * scale, .65 * scale, Math.cos(angle) * .56 * scale], palette.edge, angle);
        }
    }

    function plant(parent, position, scale = 1) {
        const [positionX, positionY, positionZ] = position;
        round(parent, .34 * scale, .5 * scale, [positionX, positionY + .25 * scale, positionZ], 0x86583e);
        round(parent, .38 * scale, .1 * scale, [positionX, positionY + .48 * scale, positionZ], 0xa47853);
        for (let branch = 0; branch < 7; branch++) {
            const angle = branch * 2.4;
            const leaf = box(parent, [.2 * scale, (.6 + random() * .5) * scale, .45 * scale], [positionX + Math.sin(angle) * .24 * scale, positionY + .85 * scale, positionZ + Math.cos(angle) * .24 * scale], branch % 2 ? 0x557965 : 0x7b956d, angle);
            leaf.rotation.z = Math.sin(angle) * .4;
        }
    }

    function lantern(parent, position, withLight = false) {
        const [positionX, positionY, positionZ] = position;
        box(parent, [.46, .55, .46], position, 0xffbf66, 0, 1.15);
        box(parent, [.62, .1, .62], [positionX, positionY - .32, positionZ], palette.coal);
        box(parent, [.62, .1, .62], [positionX, positionY + .32, positionZ], palette.coal);
        for (const offsetX of [-.25, .25]) {
            for (const offsetZ of [-.25, .25]) {
                box(parent, [.06, .68, .06], [positionX + offsetX, positionY, positionZ + offsetZ], palette.coal);
            }
        }
        box(parent, [.05, .45, .05], [positionX, positionY + .6, positionZ], palette.coal);
        glow([positionX, positionY, positionZ], 1.9, .19);
        if (withLight) {
            const light = new THREE.PointLight(0xffb766, .65, 11, 2);
            light.position.set(positionX, positionY, positionZ);
            scene.add(light);
            lamps.push(light);
        }
    }

    let glowTexture;
    function glow(position, size, opacity) {
        if (!glowTexture) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255, 218, 141, .8)');
            gradient.addColorStop(.25, 'rgba(255, 169, 68, .3)');
            gradient.addColorStop(1, 'rgba(255, 128, 32, 0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 64, 64);
            glowTexture = new THREE.CanvasTexture(canvas);
        }
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffc077, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
        sprite.position.set(...position);
        sprite.scale.set(size, size, 1);
        scene.add(sprite);
        glows.push({ sprite, opacity, phase: random() * 8 });
    }

    function windowFrame(parent, position, side = false) {
        const group = new THREE.Group();
        group.position.set(...position);
        if (side) group.rotation.y = Math.PI / 2;
        parent.add(group);
        box(group, [2.2, 2.7, .13], [0, 0, 0], 0x426d7a, 0, .6);
        box(group, [1.9, 2.4, .16], [0, 0, .03], 0x67909a, 0, .45);
        for (const offsetX of [-1.12, 0, 1.12]) box(group, [.13, 2.9, .27], [offsetX, 0, .13], palette.darkWood);
        for (const offsetY of [-1.42, 0, 1.42]) box(group, [2.4, .14, .27], [0, offsetY, .13], palette.darkWood);
        box(group, [2.65, .2, .65], [0, -1.55, .25], palette.oak);
        box(group, [.42, 3.2, .33], [-1.55, -.05, .15], palette.teal);
        box(group, [.42, 3.2, .33], [1.55, -.05, .15], palette.teal);
    }

    function textSign(parent, text, size, position) {
        const canvas = document.createElement('canvas');
        canvas.width = 768;
        canvas.height = 192;
        const context = canvas.getContext('2d');
        context.fillStyle = '#283732';
        context.fillRect(0, 0, 768, 192);
        context.strokeStyle = '#b3975d';
        context.lineWidth = 7;
        context.strokeRect(15, 15, 738, 162);
        context.font = '54px Georgia, serif';
        context.fillStyle = '#e1c591';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 384, 99);
        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        const signMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(...size), signMaterial);
        sign.position.set(...position);
        sign.castShadow = true;
        parent.add(sign);
    }

    function buildRoom() {
        box(envGroup, [24.6, 1.45, 24.6], [0, -.8, 0], palette.mortar);
        box(envGroup, [25, .22, 25], [0, -.12, 0], palette.darkWood);
        for (let row = 0; row < 24; row++) {
            for (let column = 0; column < 9; column++) {
                const color = new THREE.Color(palette.wood).multiplyScalar(.8 + random() * .4);
                const startX = Math.max(-12, -12 + column * 3 - (row % 2) * 1.5);
                const endX = Math.min(12, -9 + column * 3 - (row % 2) * 1.5);
                if (endX <= startX) continue;
                const positionX = (startX + endX) / 2;
                const positionZ = -11.5 + row;
                box(envGroup, [endX - startX - .06, .14, .94], [positionX, 0, positionZ], color.getHex());
                if (random() > .58) box(envGroup, [Math.min(endX - startX - .2, 1.3 + random()), .012, .025], [positionX, .077, positionZ + .19], palette.edge);
            }
        }
        for (let course = 0; course < 3; course++) {
            for (let block = 0; block < 12; block++) {
                const shade = new THREE.Color(palette.stone).multiplyScalar(.82 + random() * .3).getHex();
                box(envGroup, [1.96, .62, .65], [-11 + block * 2, .4 + course * .68, -12.1], shade);
                box(envGroup, [.65, .62, 1.96], [-12.1, .4 + course * .68, -11 + block * 2], shade);
            }
        }
        box(envGroup, [24.5, 3.7, .6], [0, 3.8, -12.1], palette.plaster);
        box(envGroup, [.6, 3.7, 24.5], [-12.1, 3.8, 0], palette.plaster);
        for (const beamHeight of [2.1, 5.7]) {
            box(envGroup, [24.7, .24, .85], [0, beamHeight, -12], palette.darkWood);
            box(envGroup, [.85, .24, 24.7], [-12, beamHeight, 0], palette.darkWood);
        }
        for (const beamPosition of [-12, -6, 0, 6, 12]) {
            box(envGroup, [.33, 5.8, .9], [beamPosition, 2.9, -12], palette.darkWood);
            box(envGroup, [.9, 5.8, .33], [-12, 2.9, beamPosition], palette.darkWood);
            const backBrace = box(envGroup, [2, .2, .4], [beamPosition + .8, 5.05, -11.7], palette.darkWood);
            backBrace.rotation.z = .65;
            const sideBrace = box(envGroup, [.4, .2, 2], [-11.7, 5.05, beamPosition + .8], palette.darkWood);
            sideBrace.rotation.x = -.65;
        }
        windowFrame(envGroup, [-11.7, 3.9, -4], true);
        windowFrame(envGroup, [-11.7, 3.9, 3], true);
        box(envGroup, [.85, .3, 25], [-12, 6.05, 0], palette.oak);
        box(envGroup, [25, .3, .85], [0, 6.05, -12], palette.oak);
        box(envGroup, [25, .32, .28], [0, -.05, 12.4], palette.oak);
        box(envGroup, [.28, .32, 25], [12.4, -.05, 0], palette.oak);

        box(envGroup, [15.5, 2.25, 1.85], [-3.4, 1.18, -8.7], palette.darkWood);
        for (let panel = 0; panel < 8; panel++) {
            const positionX = -10.1 + panel * 1.9;
            box(envGroup, [1.6, 1.65, .14], [positionX, 1.2, -7.72], palette.wood);
            box(envGroup, [1.38, 1.35, .16], [positionX, 1.2, -7.62], palette.edge);
        }
        box(envGroup, [16, .32, 2.25], [-3.4, 2.48, -8.7], palette.oak);
        box(envGroup, [15.7, .12, .09], [-3.4, .34, -7.6], palette.brass);
        box(envGroup, [10.6, 3.1, .46], [-4, 3.5, -11.55], palette.darkWood);
        for (const shelfHeight of [2.2, 3.25, 4.3, 5.3]) {
            box(envGroup, [10.85, .14, .9], [-4, shelfHeight, -11.3], palette.oak);
        }
        for (const divider of [-9.2, -5.8, -2.4, 1.2]) box(envGroup, [.15, 3.2, .85], [divider, 3.65, -11.3], palette.edge);
        const bottleColors = [0x426456, 0x7a633e, 0x40616b, 0x733f40];
        for (let shelf = 0; shelf < 3; shelf++) {
            for (let item = 0; item < 18; item++) {
                if (random() > .15) bottle(envGroup, [-8.9 + item * .55, 2.3 + shelf * 1.05, -10.97], bottleColors[item % 4], .67 + random() * .25);
            }
        }
        textSign(envGroup, 'THE LAST HEARTH', [5.6, 1.4, .22], [-4, 6.55, -11.95]);
        for (const hanger of [-6.1, -1.9]) box(envGroup, [.045, .8, .045], [hanger, 7.55, -11.95], palette.coal);
        for (const counterPosition of [-9, -6, -2, 1.6]) {
            mug(envGroup, [counterPosition, 2.67, -8.1]);
            bottle(envGroup, [counterPosition + .5, 2.67, -8.8], bottleColors[Math.floor(random() * 4)]);
        }
        candle(envGroup, [-5.5, 2.67, -8.2], 1.1);
        candle(envGroup, [2.7, 2.67, -8.5], 1.1);
        for (const stoolPosition of [-8.5, -4.5, -.5]) {
            round(envGroup, .43, .16, [stoolPosition, 1.05, -6.6], palette.oak);
            round(envGroup, .13, 1, [stoolPosition, .5, -6.6], palette.darkWood);
            round(envGroup, .35, .12, [stoolPosition, .16, -6.6], palette.edge);
        }
        barrel(envGroup, [-10.5, .08, -9.9]);
        barrel(envGroup, [3, .08, -10.2], .9);
        barrel(envGroup, [-10.5, .08, 8.8], 1.2);
        barrel(envGroup, [-9.3, .08, 10.3], .85);
        box(envGroup, [1.4, 1.2, 1.3], [-10.5, .7, 6.8], palette.oak);
        for (const boardHeight of [.25, .65, 1.05]) box(envGroup, [1.45, .08, 1.35], [-10.5, boardHeight, 6.8], palette.edge);
        plant(envGroup, [-10.6, 1.33, 6.8], .8);
        plant(envGroup, [10.8, .08, -10.6], 1.6);
        plant(envGroup, [-10.9, .08, -5.6], 1.15);
        const noticeboard = new THREE.Group();
        noticeboard.position.set(-11.6, 3.8, 8.4);
        noticeboard.rotation.y = Math.PI / 2;
        envGroup.add(noticeboard);
        box(noticeboard, [2.5, 1.8, .18], [0, 0, 0], palette.darkWood);
        box(noticeboard, [2.22, 1.52, .2], [0, 0, .04], 0x775a3d);
        for (let note = 0; note < 5; note++) {
            const noteX = -.75 + (note % 3) * .65;
            const noteY = note > 2 ? -.35 : .33;
            box(noticeboard, [.48, .57, .025], [noteX, noteY, .16], note % 2 ? 0xd2b983 : palette.cream);
            box(noticeboard, [.07, .07, .04], [noteX, noteY + .2, .18], 0x7c4d38);
            for (let line = 0; line < 3; line++) box(noticeboard, [.26, .02, .025], [noteX, noteY - .02 - line * .1, .18], 0x88755c);
        }
        for (const bannerX of [-10.4, 2.7]) {
            box(envGroup, [.85, 1.7, .08], [bannerX, 4.2, -11.7], bannerX < 0 ? palette.teal : 0x773f36);
            box(envGroup, [.16, .82, .11], [bannerX, 4.25, -11.62], palette.brass);
            box(envGroup, [.6, .15, .11], [bannerX, 4.2, -11.6], palette.brass);
            box(envGroup, [1.05, .08, .15], [bannerX, 5.09, -11.6], palette.oak);
        }
        box(envGroup, [3, .04, 5], [7.8, .1, 8.5], palette.teal);
        for (const borderX of [6.4, 9.2]) box(envGroup, [.08, .02, 4.8], [borderX, .13, 8.5], palette.brass);
        for (const borderZ of [6.15, 10.85]) box(envGroup, [2.8, .02, .08], [7.8, .13, borderZ], palette.brass);
        for (let stitch = 0; stitch < 12; stitch++) {
            box(envGroup, [.09, .02, .3], [6.45 + stitch * .24, .13, 5.9], palette.cream);
            box(envGroup, [.09, .02, .3], [6.45 + stitch * .24, .13, 11.1], palette.cream);
        }
        for (let step = 0; step < 3; step++) box(envGroup, [4, .3, 1], [7.8, -.25 - step * .3, 12.8 + step * .85], palette.stone);

        buildFireplace();
        buildChandelier([-2, 6.5, 1]);
        lantern(envGroup, [-11.45, 4, 8], true);
        lantern(envGroup, [3.5, 4.3, -11.5], true);
        lantern(envGroup, [10.8, 3.1, 11.5], false);
        box(envGroup, [.18, 3.5, .18], [10.8, 1.7, 11.5], palette.darkWood);
        box(envGroup, [5.5, .03, 4.4], [0, .09, 0], 0x683d32);
        for (const rugEdge of [-2.58, 2.58]) box(envGroup, [.08, .02, 4.1], [rugEdge, .11, 0], palette.brass);
        for (const rugEdge of [-2, 2]) box(envGroup, [5.1, .02, .08], [0, .11, rugEdge], palette.brass);
        const keeper = character('ADVENTURER', '酒馆老板', true);
        keeper.position.set(-3.5, 0, -10);
        keeper.rotation.y = .1;
        scene.add(keeper);
        decorativeGuests.push(keeper);
        bakeGroup(envGroup);
    }

    function buildFireplace() {
        box(envGroup, [4.6, 4.6, 1.4], [7.5, 2.3, -11.15], palette.mortar);
        box(envGroup, [2.8, 2.35, .12], [7.5, 1.35, -10.39], palette.coal);
        for (const pillarX of [5.65, 9.35]) {
            for (let block = 0; block < 4; block++) {
                box(envGroup, [.95, .62, 1.7], [pillarX, .4 + block * .65, -10.5], block % 2 ? palette.stone : 0x626664);
            }
        }
        box(envGroup, [4.7, .7, 1.85], [7.5, 2.95, -10.65], 0x656967);
        box(envGroup, [5, .25, 2], [7.5, 3.42, -10.65], palette.oak);
        box(envGroup, [3.3, 2.2, 1.2], [7.5, 4.6, -11.1], palette.stone);
        box(envGroup, [5, .25, 2.8], [7.5, .14, -9.8], 0x646665);
        for (let log = 0; log < 3; log++) {
            round(envGroup, .19, 1.6, [6.9 + log * .45, .5, -9.95], palette.edge, [0, 0, Math.PI / 2]);
        }
        for (let flame = 0; flame < 9; flame++) {
            const height = .5 + random() * .85;
            const mesh = box(scene, [.22 + random() * .2, height, .25], [6.65 + random() * 1.65, .55 + height / 2, -10.2 + random() * .6], flame % 2 ? 0xffa43b : 0xffda79, 0, 2.2);
            flameObjects.push({ mesh, height, phase: random() * 10 });
        }
        fireLight = new THREE.PointLight(0xff9b42, 1.5, 15, 2);
        fireLight.position.set(7.5, 1.9, -9);
        scene.add(fireLight);
        glow([7.5, 1.35, -9.5], 4.1, .3);
        candle(envGroup, [5.5, 3.55, -10.4], 1.3);
        bottle(envGroup, [8.8, 3.55, -10.4], 0x465b4c, .85);
        box(envGroup, [1.25, 1.5, .12], [7.5, 4.55, -10.42], palette.darkWood);
        box(envGroup, [.9, 1.15, .14], [7.5, 4.55, -10.32], palette.teal);
        box(envGroup, [.32, .7, .15], [7.5, 4.55, -10.22], palette.brass);
        barrel(envGroup, [10.5, .1, -8], .8);
    }

    function buildChandelier(position) {
        const [positionX, positionY, positionZ] = position;
        box(envGroup, [.055, 2, .055], [positionX, positionY + 1.2, positionZ], palette.coal);
        box(envGroup, [3.2, .14, .16], [positionX, positionY, positionZ], palette.coal);
        box(envGroup, [.16, .14, 3.2], [positionX, positionY, positionZ], palette.coal);
        for (const offset of [-1.4, 1.4]) {
            candle(envGroup, [positionX + offset, positionY, positionZ], 1.3);
            candle(envGroup, [positionX, positionY, positionZ + offset], 1.3);
            glow([positionX + offset, positionY + .6, positionZ], 1.1, .15);
            glow([positionX, positionY + .6, positionZ + offset], 1.1, .15);
        }
        const light = new THREE.PointLight(0xffd08d, .8, 18, 2);
        light.position.set(positionX, positionY - .6, positionZ);
        scene.add(light);
        lamps.push(light);
    }

    function chair(positionX, positionZ, tableX, tableZ) {
        const group = new THREE.Group();
        group.position.set(positionX, 0, positionZ);
        group.rotation.y = Math.atan2(tableX - positionX, tableZ - positionZ);
        box(group, [.85, .16, .85], [0, .72, 0], palette.oak);
        box(group, [.75, .13, .72], [0, .86, 0], 0x715341);
        for (const legX of [-.32, .32]) {
            for (const legZ of [-.32, .32]) box(group, [.12, .7, .12], [legX, .35, legZ], palette.darkWood);
            box(group, [.12, 1.1, .12], [legX, 1.05, -.36], palette.edge);
        }
        box(group, [.82, .38, .14], [0, 1.43, -.36], palette.wood);
        bakeGroup(group);
        envGroup.add(group);
        return group;
    }

    function table(positionX, positionZ) {
        const group = new THREE.Group();
        group.position.set(positionX, 0, positionZ);
        for (let board = 0; board < 5; board++) box(group, [2.3, .22, .44], [0, 1.35, -.9 + board * .45], board % 2 ? palette.oak : 0x966a3e);
        for (const legX of [-.8, .8]) {
            for (const legZ of [-.8, .8]) box(group, [.22, 1.25, .22], [legX, .62, legZ], palette.edge);
        }
        box(group, [1.8, .18, .15], [0, .5, 0], palette.darkWood);
        candle(group, [0, 1.48, 0]);
        mug(group, [.68, 1.48, .55], .9);
        mug(group, [-.68, 1.48, -.45], .9);
        round(group, .28, .04, [.62, 1.5, -.6], palette.cream);
        box(group, [.24, .12, .2], [.62, 1.57, -.6], 0xb87c45);
        bakeGroup(group);
        envGroup.add(group);
        return group;
    }

    function character(category, name, keeper = false) {
        const group = new THREE.Group();
        const body = new THREE.Group();
        group.add(body);
        if (name === '岩石史莱姆') {
            round(body, .62, .68, [0, .52, 0], 0x749b8d);
            round(body, .46, .33, [0, .93, 0], 0x98b6a0);
            for (const eyeX of [-.18, .18]) box(body, [.1, .12, .07], [eyeX, .76, .51], palette.coal);
            box(body, [.25, .12, .06], [0, .53, .59], 0x465c51);
            box(body, [.2, .24, .2], [-.19, 1.2, 0], 0xb1b7a1);
            bakeGroup(body);
            group.userData.body = body;
            group.userData.category = category;
            return group;
        }
        const outfits = category === 'ADVENTURER' ? [0x4b7781, 0x69734a, 0x865742, 0x5a6477] : category === 'MONSTER' ? [0x704b35, 0x555d47, 0x7c4841] : [0x4c4967, 0x384a50, 0x654b65];
        const outfit = keeper ? 0xd1c0a0 : outfits[Math.floor(random() * outfits.length)];
        const isSkeleton = name === '骷髅兵';
        const isGoblin = name === '绿皮哥布林';
        const skin = category === 'MONSTER' ? (isSkeleton ? 0xd8d1b3 : isGoblin ? 0x86a26a : 0xa18a78) : 0xd1a17a;
        box(body, [.67, .85, .43], [0, 1.25, 0], outfit);
        box(body, [.69, .13, .45], [0, 1.02, .01], palette.darkWood);
        box(body, [.15, .14, .05], [.05, 1.02, .26], palette.brass);
        const legs = [];
        const arms = [];
        for (const side of [-1, 1]) {
            const leg = new THREE.Group();
            leg.position.set(side * .2, .82, 0);
            body.add(leg);
            box(leg, [.24, .54, .28], [0, -.27, 0], keeper ? 0x534637 : 0x484747);
            box(leg, [.29, .23, .43], [0, -.62, .06], palette.darkWood);
            bakeGroup(leg);
            leg.children.forEach(mesh => { mesh.userData.animated = true; });
            legs.push(leg);
            const arm = new THREE.Group();
            arm.position.set(side * .44, 1.52, 0);
            body.add(arm);
            box(arm, [.2, .63, .25], [0, -.3, 0], outfit);
            box(arm, [.21, .22, .25], [0, -.69, .02], skin);
            bakeGroup(arm);
            arm.children.forEach(mesh => { mesh.userData.animated = true; });
            arms.push(arm);
        }
        box(body, [.58, .59, .53], [0, 1.99, .02], skin);
        box(body, [.13, .1, .06], [-.17, 2.02, .3], palette.coal);
        if (name === '独眼巨魔') {
            box(body, [.2, .15, .07], [0, 2.06, .31], palette.cream);
            box(body, [.08, .11, .08], [0, 2.06, .35], palette.coal);
        } else box(body, [.1, .1, .06], [.17, 2.02, .3], palette.coal);
        box(body, [.1, .13, .11], [0, 1.9, .3], skin);
        if (keeper) {
            box(body, [.51, .6, .06], [0, 1.28, .25], palette.cream);
            box(body, [.58, .12, .56], [0, 2.32, 0], 0x6b5141);
            box(body, [.5, .15, .08], [0, 1.75, .31], 0x6b5141);
        } else if (category === 'MYSTERIOUS' || name.includes('法师')) {
            box(body, [.74, .22, .68], [0, 2.31, 0], outfit);
            box(body, [.55, .26, .49], [0, 2.48, -.02], outfit);
            box(body, [.35, .24, .31], [0, 2.71, -.04], outfit);
            box(body, [.17, .18, .17], [.04, 2.91, -.06], outfit);
            box(body, [.69, .75, .13], [0, 1.27, -.28], outfit);
            box(body, [.12, .12, .1], [0, 1.55, .27], palette.brass);
        } else if (isGoblin || name === '魅魔') {
            for (const side of [-1, 1]) {
                const ear = box(body, [.33, .14, .2], [side * .4, 2.1, 0], skin);
                ear.rotation.z = side * .4;
                if (name === '魅魔') box(body, [.12, .27, .14], [side * .22, 2.39, 0], palette.cream);
            }
        } else if (!isSkeleton) {
            const helmet = name.includes('骑士') || name.includes('剑士');
            box(body, [.63, .2, .6], [0, 2.3, 0], helmet ? 0x9ca7a5 : 0x563e2e);
            if (helmet) {
                box(body, [.12, .43, .13], [0, 2.11, .33], 0x9ca7a5);
                box(body, [.16, .25, .35], [0, 2.51, -.05], 0xa36551);
                box(body, [.23, .18, .48], [-.44, 1.64, 0], 0x9ca7a5);
                box(body, [.23, .18, .48], [.44, 1.64, 0], 0x9ca7a5);
            } else {
                box(body, [.12, .34, .52], [-.27, 2.07, -.05], 0x563e2e);
                box(body, [.12, .34, .52], [.27, 2.07, -.05], 0x563e2e);
            }
            box(body, [.14, 1.05, .13], [.56, .94, -.18], palette.coal);
            box(body, [.35, .1, .12], [.56, 1.47, -.18], palette.brass);
        }
        if (isSkeleton) {
            box(body, [.27, .16, .06], [0, 1.76, .3], palette.coal);
            box(body, [.09, .1, .08], [0, 1.78, .31], palette.cream);
        }
        if (name === '流浪诗人') {
            round(body, .3, .14, [-.42, 1.1, .25], palette.oak, [Math.PI / 2, 0, 0]);
            box(body, [.12, .7, .1], [-.42, 1.59, .26], palette.edge);
            for (const stringX of [-.45, -.4]) box(body, [.015, .8, .02], [stringX, 1.44, .35], palette.cream);
        }
        if (name === '新手牧师' || name.includes('法师')) {
            box(body, [.1, 2.2, .1], [.62, 1.15, .05], palette.oak);
            box(body, [.27, .23, .27], [.62, 2.37, .05], name.includes('法师') ? 0x7eabc3 : palette.brass, 0, .3);
        }
        if (name === '独眼巨魔') group.scale.set(1.25, 1.13, 1.25);
        if (isGoblin) group.scale.set(.88, .8, .88);
        bakeGroup(body);
        group.userData.body = body;
        group.userData.category = category;
        group.userData.legs = legs;
        group.userData.arms = arms;
        const drink = new THREE.Group();
        mug(drink, [0, -.78, .04], .7);
        bakeGroup(drink);
        drink.visible = false;
        arms[1].add(drink);
        group.userData.drink = drink;
        return group;
    }

    function animateCharacter(group, state, timer) {
        const { body, legs, arms, drink } = group.userData;
        if (!legs) {
            body.scale.y = reducedMotion ? 1 : 1 + Math.sin(timer * 3) * .06;
            return;
        }
        const sitting = state === 'DRINKING';
        const walking = state === 'SEEK_SEAT' || state === 'LEAVING';
        const lift = sitting ? (Math.sin(timer * .9) > .6 ? -1.7 : -.85) : 0;
        legs.forEach((leg, index) => {
            leg.rotation.x = sitting ? -1.3 : walking && !reducedMotion ? Math.sin(timer * 10 + index * Math.PI) * .3 : 0;
        });
        arms.forEach((arm, index) => {
            arm.rotation.x = sitting ? (index ? lift : -.5) : walking && !reducedMotion ? Math.sin(timer * 10 + index * Math.PI) * -.25 : 0;
        });
        drink.visible = sitting;
        if (sitting) body.position.y = -.12 + (reducedMotion ? 0 : Math.sin(timer * 2) * .025);
    }

    function feedback(position, color = 0xe6d2a3, count = 18) {
        if (reducedMotion) return;
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let index = 0; index < count; index++) {
            positions.set(position, index * 3);
            velocities.push(new THREE.Vector3((random() - .5) * 2, .8 + random() * 1.3, (random() - .5) * 2));
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .13, transparent: true, opacity: .9, depthWrite: false }));
        scene.add(points);
        bursts.push({ points, velocities, age: 0 });
    }

    function buildAtmosphere() {
        const count = 90;
        const positions = new Float32Array(count * 3);
        for (let particle = 0; particle < count; particle++) {
            const position = new THREE.Vector3((random() - .5) * 45, random() * 11, (random() - .5) * 40);
            particles.push({ position, speed: .05 + random() * .12, phase: random() * 10 });
            position.toArray(positions, particle * 3);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xc8c49e, size: .045, transparent: true, opacity: .42, depthWrite: false }));
        points.userData.atmosphere = true;
        scene.add(points);
        for (let rock = 0; rock < 16; rock++) {
            const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(.7 + random() * 1.2, 0), material(palette.mortar));
            const angle = random() * Math.PI * 2;
            const distance = 16 + random() * 9;
            mesh.position.set(Math.cos(angle) * distance, -3 - random() * 5, Math.sin(angle) * distance);
            mesh.rotation.set(random(), random(), random());
            scene.add(mesh);
        }
        return points;
    }

    let dust;

    function create() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x182833);
        scene.fog = new THREE.FogExp2(0x182833, .005);
        camera = new THREE.OrthographicCamera(-20, 20, 15, -15, .1, 140);
        camera.position.set(32, 29, 36);
        cameraTarget = new THREE.Vector3(-4, 1.6, 0);
        camera.lookAt(cameraTarget);
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(1);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = false;
        document.getElementById('canvas-container').appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-label', '深渊之末酒馆的等轴体素场景');
        scene.add(new THREE.HemisphereLight(0xb5c9d1, 0x79513a, .45));
        const sunlight = new THREE.DirectionalLight(0xffd3a0, 1.3);
        sunlight.position.set(1, 20, 12);
        sunlight.castShadow = true;
        sunlight.shadow.mapSize.set(2048, 2048);
        sunlight.shadow.camera.left = -19;
        sunlight.shadow.camera.right = 19;
        sunlight.shadow.camera.top = 19;
        sunlight.shadow.camera.bottom = -19;
        sunlight.shadow.camera.far = 65;
        sunlight.shadow.normalBias = .04;
        sunlight.shadow.bias = -.0002;
        scene.add(sunlight);
        moonLight = new THREE.DirectionalLight(0x76b7dc, .45);
        moonLight.position.set(-15, 8, -4);
        scene.add(moonLight);
        envGroup = new THREE.Group();
        scene.add(envGroup);
        buildRoom();
        dust = buildAtmosphere();
        resize();
        window.addEventListener('resize', resize);
        renderer.domElement.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            if (typeof game !== 'undefined') game.pause(true);
            document.getElementById('log-preview').textContent = '画面暂时中断，正在等待显卡恢复…';
        });
        renderer.domElement.addEventListener('webglcontextrestored', () => {
            renderer.shadowMap.needsUpdate = true;
            if (typeof game !== 'undefined') game.addLog('炉火重新亮起，可以继续营业了。', 'sys');
        });
        return { scene, camera, renderer, envGroup };
    }

    function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspect = width / height;
        const viewHeight = width <= 900 ? Math.max(20, 18 / aspect) : Math.max(16.5, 22 / aspect);
        camera.left = -viewHeight * aspect;
        camera.right = viewHeight * aspect;
        camera.top = viewHeight;
        camera.bottom = -viewHeight;
        camera.updateProjectionMatrix();
        const scale = Math.min(1, (width <= 760 ? 680 : 1100) / width);
        renderer.setSize(Math.round(width * scale), Math.round(height * scale), false);
    }

    function update(delta, dayRatio, intro) {
        elapsed += delta;
        for (let index = bursts.length - 1; index >= 0; index--) {
            const burst = bursts[index];
            burst.age += delta;
            if (burst.age > 1.5) {
                scene.remove(burst.points);
                burst.points.geometry.dispose();
                burst.points.material.dispose();
                bursts.splice(index, 1);
                continue;
            }
            const positions = burst.points.geometry.attributes.position;
            burst.velocities.forEach((velocity, pointIndex) => {
                positions.setXYZ(pointIndex, positions.getX(pointIndex) + velocity.x * delta, positions.getY(pointIndex) + velocity.y * delta, positions.getZ(pointIndex) + velocity.z * delta);
                velocity.y -= delta * .6;
            });
            positions.needsUpdate = true;
            burst.points.material.opacity = .9 * (1 - burst.age / 1.5);
        }
        if (!reducedMotion) {
            flameObjects.forEach(({ mesh, height, phase }) => {
                mesh.scale.y = height * (1 + Math.sin(elapsed * 7 + phase) * .15);
            });
            fireLight.intensity = 1.5 + Math.sin(elapsed * 8) * .08;
            lamps.forEach((light, index) => { light.intensity = (index === 0 ? .8 : .65) + Math.sin(elapsed * 3 + index) * .03; });
            const positions = dust.geometry.attributes.position;
            particles.forEach((particle, index) => {
                particle.position.y += delta * particle.speed;
                if (particle.position.y > 11) particle.position.y = .2;
                positions.setXYZ(index, particle.position.x + Math.sin(elapsed * .3 + particle.phase) * .25, particle.position.y, particle.position.z);
            });
            positions.needsUpdate = true;
            decorativeGuests.forEach(guest => { guest.userData.body.position.y = Math.sin(elapsed * 1.7) * .035; });
            glows.forEach(({ sprite, opacity, phase }) => { sprite.material.opacity = opacity * (1 + Math.sin(elapsed * 4 + phase) * .06); });
        }
        moonLight.intensity = .35 + dayRatio * .4;
        const desiredTarget = new THREE.Vector3(intro && window.innerWidth > 900 ? -6 : 0, intro && window.innerWidth <= 900 ? -3.4 : 1.1, 0);
        cameraTarget.lerp(desiredTarget, reducedMotion ? 1 : 1 - Math.exp(-delta * 3));
        camera.lookAt(cameraTarget);
    }

    function disposeCharacter(group) {
        group.traverse(object => {
            if (object.isMesh) object.geometry.dispose();
        });
    }

    return { create, table, chair, character, animateCharacter, feedback, update, disposeCharacter };
})();
