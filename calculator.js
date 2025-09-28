// Core xeme calculations
function xemmify(value, base = 10) {
    return ((value % base) + Math.floor(value / base)) % base;
}

function inverseXemmify(value, bound, base = 10) {
    const result = new Set();
    for (let x = 0; x < bound; x++) {
        if (value === xemmify(x, base)) {
            result.add(x);
        }
    }
    return result;
}

function inverseXemmifyMulti(values, bound, base = 10) {
    const result = new Set();
    values.forEach(value => {
        inverseXemmify(value, bound, base).forEach(x => result.add(x));
    });
    return result;
}

function getHeight(order, value) {
    for (let i = 0; i < order.length; i++) {
        if (order[i].has(value)) {
            return i;
        }
    }
    throw new Error("Value not found in order");
}

// Game-specific order generators
function makeRemePlayerOrder(bound, base = 10) {
    const order = [];
    // Add sets for 1-9
    for (let i = 1; i < base; i++) {
        order.push(inverseXemmify(i, bound, base));
    }
    // Add set for 0 at the end
    order.push(inverseXemmify(0, bound, base));
    return order;
}

function makeJemePlayerOrder(bound) {
    const order = [];
    order.push(inverseXemmifyMulti([2, 3, 4, 5], bound));
    for (let i = 6; i < 10; i++) {
        order.push(inverseXemmify(i, bound));
    }
    order.push(inverseXemmifyMulti([0, 1], bound));
    return order;
}

function makeLemePlayerOrder(bound) {
    const order = [];
    order.push(inverseXemmifyMulti([2, 9], bound));
    for (let i = 3; i < 9; i++) {
        order.push(inverseXemmify(i, bound));
    }
    order.push(inverseXemmifyMulti([1, 0], bound));
    return order;
}

function hostifyOrder(order) {
    return [new Set(), ...order];
}

function makeRemeHostOrder(bound, base = 10) {
    return hostifyOrder(makeRemePlayerOrder(bound, base));
}

function makeJemeHostOrder(bound) {
    return hostifyOrder(makeJemePlayerOrder(bound));
}

function makeLemeHostOrder(bound) {
    const order = [];
    order.push(new Set());
    for (let i = 2; i < 8; i++) {
        order.push(inverseXemmify(i, bound));
    }
    order.push(inverseXemmifyMulti([8, 9], bound));
    order.push(inverseXemmifyMulti([1, 0], bound));
    return order;
}

// Weight functions
function getRemeWeight(num, base = 10) {
    return xemmify(num, base) === 0 ? 3 : 2;
}

function getJemeWeight(num) {
    const xem = xemmify(num);
    if (xem === 0) return 5;
    if (xem === 1) return 4;
    return 2;
}

function getLemeWeight(num) {
    const xem = xemmify(num);
    if (xem === 0) return 4;
    if (xem === 1) return 3;
    return 2;
}

// EV and edge calculations
function getEV(playerOrder, opponentOrder, weightFunc, bound) {
    let ev = 0;
    const p = 1 / (bound * bound);
    
    for (let hostNum = 0; hostNum < bound; hostNum++) {
        for (let playerNum = 0; playerNum < bound; playerNum++) {
            if (getHeight(playerOrder, playerNum) < getHeight(opponentOrder, hostNum)) {
                continue;
            }
            ev += p * weightFunc(playerNum);
        }
    }
    return ev;
}

function getEdge(ev, rounds) {
    return 1 - Math.pow(ev, rounds);
}

// Value transformation functions
function qqTransform(value, base) {
    return value % base;
}

function inverseQQTransform(displayValue, bound, base) {
    const result = new Set();
    for (let x = 0; x < bound; x++) {
        if (displayValue === qqTransform(x, base)) {
            result.add(x);
        }
    }
    return result;
}

function transformValue(value, type, base) {
    switch (type) {
        case 'xemmify':
            return xemmify(value, base);
        case 'qq10':
        case 'raw':
            return qqTransform(value, type === 'raw' ? BOUND : base);
        default:
            return value;
    }
}

function inverseTransform(displayValue, bound, type, base) {
    switch (type) {
        case 'xemmify':
            return inverseXemmify(displayValue, bound, base);
        case 'qq10':
            return inverseQQTransform(displayValue, bound, base);
        case 'raw':
            return new Set([displayValue]); // For raw numbers, just return the value itself
        default:
            return new Set([displayValue]);
    }
}

// UI Helper functions
function parseOrder(text, transformType, base) {
    return text.trim().split('\n').map(line => {
        const displayNumbers = line.split(',')
            .map(n => n.trim())
            .filter(n => n !== '')
            .map(n => parseInt(n))
            .filter(n => !isNaN(n));
        
        if (displayNumbers.length === 0) {
            return new Set(); // Empty set
        }

        // Combine all inverse transformations for the display numbers
        const rawNumbers = new Set();
        displayNumbers.forEach(num => {
            inverseTransform(num, BOUND, transformType, base).forEach(x => rawNumbers.add(x));
        });
        return rawNumbers;
    });
}

function formatOrder(order, transformType, base) {
    return order.map(set => {
        if (set.size === 0) return ','; // Empty set
        
        // Transform the raw numbers to display values and remove duplicates
        const displayValues = new Set();
        Array.from(set).forEach(num => {
            displayValues.add(transformValue(num, transformType, base));
        });
        
        return Array.from(displayValues).sort((a, b) => a - b).join(',');
    }).join('\n');
}

// Game presets
const BOUND = 37; // Roulette numbers 0-36

const gamePresets = {
    reme: {
        player: () => makeRemePlayerOrder(BOUND),
        host: () => makeRemeHostOrder(BOUND),
        weight: getRemeWeight
    },
    jeme: {
        player: () => makeJemePlayerOrder(BOUND),
        host: () => makeJemeHostOrder(BOUND),
        weight: getJemeWeight
    },
    leme: {
        player: () => makeLemePlayerOrder(BOUND),
        host: () => makeLemeHostOrder(BOUND),
        weight: getLemeWeight
    }
};

// Initialize the calculator
document.addEventListener('DOMContentLoaded', () => {
    const gameSelect = document.getElementById('game-type');
    const loadPresetBtn = document.getElementById('load-preset');
    const playerOrderInput = document.getElementById('player-order');
    const hostOrderInput = document.getElementById('host-order');
    const transformSelect = document.getElementById('transform-type');
    const baseInput = document.getElementById('base');
    
    function getTransformationSettings() {
        return {
            type: transformSelect.value,
            base: parseInt(baseInput.value) || 10
        };
    }
    
    function updateCalculations() {
        try {
            const { type, base } = getTransformationSettings();
            const playerOrder = parseOrder(playerOrderInput.value, type, base);
            const hostOrder = parseOrder(hostOrderInput.value, type, base);
            const weightFunc = gamePresets[gameSelect.value].weight;
            
            const ev = getEV(playerOrder, hostOrder, weightFunc, BOUND);
            
            document.getElementById('ev-1r').textContent = ev.toFixed(4);
            document.getElementById('edge-1r').textContent = (getEdge(ev, 1) * 100).toFixed(2) + '%';
            document.getElementById('edge-2r').textContent = (getEdge(ev, 2) * 100).toFixed(2) + '%';
            document.getElementById('edge-4r').textContent = (getEdge(ev, 4) * 100).toFixed(2) + '%';
        } catch (e) {
            console.error('Calculation error:', e);
        }
    }
    
    function updateDisplay() {
        const { type, base } = getTransformationSettings();
        const game = gameSelect.value;
        const preset = gamePresets[game];
        
        // Only update if there's content or we're loading a preset
        if (playerOrderInput.value || preset) {
            const playerOrder = playerOrderInput.value ? 
                parseOrder(playerOrderInput.value, type, base) : 
                preset.player();
            playerOrderInput.value = formatOrder(playerOrder, type, base);
        }
        
        if (hostOrderInput.value || preset) {
            const hostOrder = hostOrderInput.value ? 
                parseOrder(hostOrderInput.value, type, base) : 
                preset.host();
            hostOrderInput.value = formatOrder(hostOrder, type, base);
        }
        
        updateCalculations();
    }
    
    loadPresetBtn.addEventListener('click', () => {
        const { type, base } = getTransformationSettings();
        const game = gameSelect.value;
        const preset = gamePresets[game];
        
        playerOrderInput.value = formatOrder(preset.player(), type, base);
        hostOrderInput.value = formatOrder(preset.host(), type, base);
        
        updateCalculations();
    });
    
    // Update display when transformation settings change
    transformSelect.addEventListener('change', updateDisplay);
    baseInput.addEventListener('change', updateDisplay);
    baseInput.addEventListener('input', updateDisplay);
    
    // Show/hide base input based on transform type
    function updateBaseVisibility() {
        const type = transformSelect.value;
        baseInput.parentElement.style.display = type === 'raw' ? 'none' : 'inline';
        baseInput.value = type === 'raw' ? '37' : '10';
        updateDisplay();
    }
    transformSelect.addEventListener('change', updateBaseVisibility);
    
    // Update calculations when input changes
    playerOrderInput.addEventListener('input', updateCalculations);
    hostOrderInput.addEventListener('input', updateCalculations);
    
    // Initialize
    updateBaseVisibility();
    loadPresetBtn.click();
});