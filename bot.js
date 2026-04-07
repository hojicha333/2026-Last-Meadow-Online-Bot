/**
 * Last Meadow Online - Automation Bot
 * Designed for Discord 2026 April Fools Event
 */

(function() {
    // Configuration
    const CONFIG = {
        tickSpeed: 100,           // Main loop interval (ms)
        navCheckRate: 15000,      // Navigation cooldown (ms)
        battleClickDelay: 1100,   // Delay after battle actions (ms)
        craftKeyDelay: 80         // Keystroke interval for crafting (ms)
    };

    let state = {
        lastNavCheck: 0,
        currentTab: 'Adventure',
        memory: {},               // Battle: DNA memory mapping
        eliminatedIndices: new Set(), // Battle: Ignored indices after match
        lastCraftSeq: '',         
        craftIndex: 0,
        isActing: false
    };

    const SELECTORS = {
        battleCard: '.gridAsset__0dcd3',
        battleFront: 'gridAssetFront__0dcd3'
    };

    console.log("%c[AutoBot] 🟢 Initialized. GLHF!", "color: #00ff00; font-weight: bold;");

    /**
     * Bypasses synthetic event restrictions by directly invoking React's internal onClick handler.
     */
    function reactInvoke(el) {
        if (!el) return;
        const rKey = Object.keys(el).find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'));
        const props = el[rKey];
        if (props && typeof props.onClick === 'function') {
            props.onClick({ 
                stopImmediatePropagation: () => {}, 
                stopPropagation: () => {}, 
                preventDefault: () => {}, 
                target: el, 
                currentTarget: el, 
                isTrusted: true 
            });
            return true;
        }
        el.click(); // Fallback
    }

    /**
     * Extracts SVG path data as a unique identifier for card patterns.
     */
    function getDNA(el) {
        const path = el.querySelector('path');
        return path ? path.getAttribute('d').substring(0, 50) : null;
    }

    // --- Task Modules ---

    function handleDragon() {
        const dragon = document.querySelector('img.dragon__8e80e, img[alt="Grass Toucher"]');
        if (dragon) reactInvoke(dragon);
    }

    function handleAdventure() {
        if (state.currentTab !== 'Adventure') return;
        const btns = Array.from(document.querySelectorAll('div[role="button"], button'))
            .filter(b => b.textContent.includes('Adventure') && !/\d+:\d+/.test(b.textContent));
        if (btns.length > 0) reactInvoke(btns[0]);
    }

    function handleBattle() {
        if (state.currentTab !== 'Battle' || state.isActing) return;

        const continueBtn = Array.from(document.querySelectorAll('div[role="button"], button'))
            .find(b => b.textContent && b.textContent.includes('Continue'));
            
        if (continueBtn) {
            console.log("%c[Battle] 🎉 Victory. Claiming rewards...", "color: #ffd700;");
            reactInvoke(continueBtn);
            state.memory = {}; 
            state.eliminatedIndices.clear();
            state.isActing = true;
            setTimeout(() => { state.isActing = false; forceSwitch('Adventure'); }, 2000);
            return;
        }

        const allCards = Array.from(document.querySelectorAll(SELECTORS.battleCard));
        if (allCards.length < 9) return;

        state.isActing = true;
        try {
            let faceDownCards = [];
            
            // Scan board state
            allCards.forEach((c, i) => {
                if (state.eliminatedIndices.has(i) || window.getComputedStyle(c).opacity < 0.5) return;
                
                if (c.classList.contains(SELECTORS.battleFront)) {
                    let dna = getDNA(c);
                    if (dna) state.memory[i] = dna;
                } else {
                    faceDownCards.push({el: c, idx: i});
                }
            });

            // Match-3 evaluation
            let groups = {};
            Object.entries(state.memory).forEach(([idx, dna]) => {
                const i = parseInt(idx);
                if (state.eliminatedIndices.has(i)) return;
                if (!groups[dna]) groups[dna] = [];
                groups[dna].push(i);
            });

            let paired = false;
            for (let dna in groups) {
                if (groups[dna].length === 3) {
                    const ids = groups[dna];
                    console.log(`%c[Battle] 🔥 Match found: [${ids.map(x=>x+1).join(', ')}]`, "color: #ffaa00;");
                    
                    ids.forEach(idx => { 
                        state.eliminatedIndices.add(idx); 
                        delete state.memory[idx]; 
                    });
                    
                    ids.forEach((idx, step) => setTimeout(() => reactInvoke(allCards[idx]), step * 200));
                    paired = true; 
                    break;
                }
            }

            // Exploration
            if (!paired && faceDownCards.length > 0) {
                const target = faceDownCards[Math.floor(Math.random() * faceDownCards.length)];
                reactInvoke(target.el);
            }
        } catch (e) {
            // Silently handle DOM mutation errors
        }
        setTimeout(() => { state.isActing = false; }, CONFIG.battleClickDelay);
    }

    function handleCraft() {
        if (state.currentTab !== 'Craft' || state.isActing) return;

        const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
        const continueBtn = btns.find(b => b.textContent && b.textContent.includes('Continue'));
        
        if (continueBtn) {
            console.log("%c[Craft] 🔨 Item crafted.", "color: #ffd700;");
            reactInvoke(continueBtn);
            state.lastCraftSeq = '';
            state.isActing = true;
            setTimeout(() => { state.isActing = false; forceSwitch('Adventure'); }, 2000);
            return;
        }

        const arrows = Array.from(document.querySelectorAll('img')).filter(img => img.alt && img.alt.includes('Arrow'));
        if (arrows.length === 0) return;

        const currentSeqStr = arrows.map(a => a.alt).join(',');
        if (currentSeqStr !== state.lastCraftSeq) {
            state.lastCraftSeq = currentSeqStr;
            state.craftIndex = 0;
        }

        if (state.craftIndex < arrows.length) {
            const keyName = arrows[state.craftIndex].alt;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, code: keyName, bubbles: true }));
            state.craftIndex++;
            state.isActing = true;
            setTimeout(() => { state.isActing = false; }, CONFIG.craftKeyDelay);
        }
    }

    // --- Navigation System ---

    function isCooldownDone(tabName) {
        const elements = Array.from(document.querySelectorAll('div, button, span'))
            .filter(el => el.textContent.includes(tabName));
        if (elements.length === 0) return false;
        
        let curr = elements[elements.length - 1];
        while (curr && curr.textContent.length < 40) {
            if (/\d+:\d+/.test(curr.textContent)) return false; 
            curr = curr.parentElement;
        }
        return true; 
    }

    function forceSwitch(targetTab) {
        const btns = Array.from(document.querySelectorAll('div[role="button"]'))
            .filter(b => b.textContent.includes(targetTab));
        if (btns.length > 0) {
            reactInvoke(btns[btns.length - 1]);
            state.currentTab = targetTab;
            state.lastNavCheck = Date.now();
            console.log(`%c[Router] Navigating -> ${targetTab}`, "color: #00ffff;");
        }
    }

    function runNavigation() {
        const now = Date.now();
        if (now - state.lastNavCheck < CONFIG.navCheckRate) return;
        state.lastNavCheck = now;

        let nextTab = 'Adventure';
        if (isCooldownDone('Battle')) nextTab = 'Battle';
        else if (isCooldownDone('Craft')) nextTab = 'Craft';

        if (state.currentTab !== nextTab) forceSwitch(nextTab);
    }

    // --- Core Engine ---

    function mainLoop() {
        handleDragon();
        runNavigation();

        if (state.currentTab === 'Adventure') handleAdventure();
        else if (state.currentTab === 'Battle') handleBattle();
        else if (state.currentTab === 'Craft') handleCraft();
    }

    window.startBot = function() {
        if (window.botInterval) clearInterval(window.botInterval);
        window.botInterval = setInterval(mainLoop, CONFIG.tickSpeed);
    };

    window.stopBot = function() {
        if (window.botInterval) clearInterval(window.botInterval);
        console.log("%c[AutoBot] 🛑 Stopped.", "color: #ff0000;");
    };

    // Auto-start
    window.startBot();
})();
