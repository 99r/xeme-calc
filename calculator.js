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

    throw new Error(`Value ${value} not found in order`);
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
const BASE = 10;
const BOUND = 37;

function qqTransform(value) {
    return value % BASE;
}

function inverseQQTransform(displayValue, bound) {
    const result = new Set();
    for (let x = 0; x < bound; x++) {
        if (displayValue === qqTransform(x)) {
            result.add(x);
        }
    }
    return result;
}

function inverseQQTransformMulti(values, bound) {
    const result = new Set();
    values.forEach(value => {
        inverseQQTransform(value, bound).forEach(x => result.add(x));
    });
    return result;
}

function transformValue(value, type) {
    switch (type) {
        case 'xeme':
            return xemmify(value, BASE);
        case 'qq':
            return qqTransform(value);
        case 'raw':
            return value;
        default:
            return value;
    }
}

function inverseTransform(displayValue, bound, type) {
    switch (type) {
        case 'xeme':
            return inverseXemmify(displayValue, bound, BASE);
        case 'qq':
            return inverseQQTransform(displayValue, bound);
        case 'raw':
            return new Set([displayValue]);
        default:
            return new Set([displayValue]);
    }
}

// Weight management
class WeightManager {
    constructor() {
        this.weights = new Map();
        this.setDefaultWeights();
    }

    setDefaultWeights() {
        this.weights.clear();
        this.defaultWeight = 2;
    }

    getWeight(rawValue, transformType) {
        const transformedValue = transformValue(rawValue, transformType);
        return this.weights.get(transformedValue) || this.defaultWeight;
    }

    setWeight(transformedValue, weight) {
        // Always set the weight, even if it equals the default
        this.weights.set(transformedValue, weight);
        this.checkPresetMatch();
    }

    setDefaultWeight(weight) {
        this.defaultWeight = weight;
        // Remove any explicit weights that match the new default
        for (const [value, w] of this.weights.entries()) {
            if (w === weight) {
                this.weights.delete(value);
            }
        }
        this.checkPresetMatch();
    }

    loadPreset(game) {
        this.setDefaultWeights();
        switch (game) {
            case 'reme':
                this.weights.set(0, 3);
                break;
            case 'jeme':
                this.weights.set(0, 5);
                this.weights.set(1, 4);
                break;
            case 'leme':
                this.weights.set(0, 4);
                this.weights.set(1, 3);
                break;
        }
        this.checkPresetMatch();
    }

    // Check if two orders are equivalent by checking if each layer contains the same numbers
    // regardless of their order in the array or within each set
    areOrdersEquivalent(order1, order2) {
        if (!order1 || !order2 || order1.length !== order2.length) return false;

        // Convert both orders to arrays of arrays of numbers, sorted for comparison
        const normalized1 = order1.map(set => Array.from(set).sort((a, b) => a - b));
        const normalized2 = order2.map(set => Array.from(set).sort((a, b) => a - b));
        
        // Sort each level by its first number (or any other consistent criteria)
        // This handles the case where levels might be in different orders but contain the same sets
        const sortLevel = arr => arr.sort((a, b) => {
            // Empty arrays go first
            if (a.length === 0) return -1;
            if (b.length === 0) return 1;
            // Then sort by first number
            return a[0] - b[0];
        });

        normalized1.sort((a, b) => a[0] - b[0]);
        normalized2.sort((a, b) => a[0] - b[0]);

        // Now compare the normalized arrays
        return normalized1.every((nums, i) => {
            const otherNums = normalized2[i];
            if (nums.length !== otherNums.length) return false;
            return nums.every((num, j) => num === otherNums[j]);
        });
    }

    areWeightsEqual(weights1, weights2) {
        if (weights1.size !== weights2.size) return false;
        return Array.from(weights1.keys()).every(key => 
            weights1.get(key) === weights2.get(key)
        );
    }

    checkPresetMatch() {
        const status = document.getElementById('preset-status');
        if (!status) return;
        
        // Early returns for obvious non-matches
        if (this.defaultWeight !== 2) {
            this.setStatus(status, 'Custom');
            return;
        }

        const ordersManager = window.ordersManager;
        if (!ordersManager || !ordersManager.playerOrder || !ordersManager.hostOrder) {
            this.setStatus(status, 'Custom');
            return;
        }

        // Check against each preset in order, short-circuiting as soon as we find a match
        // Only calculate player/host orders if weights match first
        
        // REME check
        if (this.areWeightsEqual(this.weights, new Map([[0, 3]]))) {
            const remePlayer = makeRemePlayerOrder(BOUND);
            const remeHost = makeRemeHostOrder(BOUND);
            if (this.areOrdersEquivalent(ordersManager.playerOrder, remePlayer) &&
                this.areOrdersEquivalent(ordersManager.hostOrder, remeHost)) {
                this.setStatus(status, 'REME');
                return;
            }
        }

        // JEME check
        if (this.areWeightsEqual(this.weights, new Map([[0, 5], [1, 4]]))) {
            const jemePlayer = makeJemePlayerOrder(BOUND);
            const jemeHost = makeJemeHostOrder(BOUND);
            if (this.areOrdersEquivalent(ordersManager.playerOrder, jemePlayer) &&
                this.areOrdersEquivalent(ordersManager.hostOrder, jemeHost)) {
                this.setStatus(status, 'JEME');
                return;
            }
        }

        // LEME check
        if (this.areWeightsEqual(this.weights, new Map([[0, 4], [1, 3]]))) {
            const lemePlayer = makeLemePlayerOrder(BOUND);
            const lemeHost = makeLemeHostOrder(BOUND);
            if (this.areOrdersEquivalent(ordersManager.playerOrder, lemePlayer) &&
                this.areOrdersEquivalent(ordersManager.hostOrder, lemeHost)) {
                this.setStatus(status, 'LEME');
                return;
            }
        }

        // If no matches found
        this.setStatus(status, 'Custom');
    }

    setStatus(status, type) {
        status.textContent = type;
        status.className = `px-2 py-1 rounded text-sm ${type === 'Custom' ? 'bg-gray-600' : 'bg-green-600'}`;
    }

    getConfiguration() {
        return {
            defaultWeight: this.defaultWeight,
            weights: Object.fromEntries(this.weights)
        };
    }

    loadConfiguration(config) {
        this.weights.clear();
        this.defaultWeight = config.defaultWeight || 2;
        if (config.weights) {
            Object.entries(config.weights).forEach(([key, value]) => {
                this.weights.set(parseInt(key), value);
            });
        }
        this.checkPresetMatch();
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

// UI Management
class OrdersManager {
    constructor(weightManager) {
        this.weightManager = weightManager;
        this.playerOrder = [];
        this.hostOrder = [];
        this.tbody = document.getElementById('orders-body');
        this.setupSortable();
        this.setupButtons();
        this.transformType = 'xeme'; // Default transform type, otherwise qq
    }

    setupSortable() {
        new Sortable(this.tbody, {
            handle: '.handle',
            animation: 150,
            onEnd: () => this.updateHeights()
        });
    }

    setupButtons() {
        document.getElementById('add-row-top').addEventListener('click', () => this.addRow(true));
        document.getElementById('add-row-bottom').addEventListener('click', () => this.addRow(false));
    }

    createRow(height) {
        const tr = document.createElement('tr');
        tr.className = 'transition-colors hover:bg-gray-700/50';
        tr.innerHTML = `
            <td class="table-cell text-center">${height}</td>
            <td class="table-cell"><input type="text" class="input-box w-full player-set"></td>
            <td class="table-cell"><input type="text" class="input-box w-full host-set"></td>
            <td class="table-cell">
                <div class="flex gap-2 justify-center">
                    <div class="handle cursor-move hover:text-primary transition-colors">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <button class="delete-row hover:text-red-500 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        return tr;
    }

    addRow(atTop = false) {
        const height = atTop ? 0 : this.tbody.children.length;
        const row = this.createRow(height);
        
        if (atTop) {
            this.tbody.insertBefore(row, this.tbody.firstChild);
        } else {
            this.tbody.appendChild(row);
        }
        
        this.updateHeights();
        this.setupRowListeners(row);
    }

    updateHeights() {
        Array.from(this.tbody.children).forEach((row, idx) => {
            row.cells[0].textContent = idx;
        });
        this.updateOrders();
    }

    setupRowListeners(row) {
        const playerInput = row.querySelector('.player-set');
        const hostInput = row.querySelector('.host-set');
        const deleteButton = row.querySelector('.delete-row');
        
        playerInput.addEventListener('input', () => this.updateOrders());
        hostInput.addEventListener('input', () => this.updateOrders());
        
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                row.remove();
                this.updateHeights();
            });
        }
    }

    // Warning: returns in current transformation type
    getOrderFromInputs() {
        const playerOrder = [];
        const hostOrder = [];
        
        Array.from(this.tbody.children).forEach(row => {
            let playerSet = this.parseInput(row.querySelector('.player-set').value);
            let hostSet = this.parseInput(row.querySelector('.host-set').value);
            
            if (this.transformType == 'xeme') {
                playerSet = inverseXemmifyMulti(playerSet, BOUND, BASE);
                hostSet = inverseXemmifyMulti(hostSet, BOUND, BASE);
            }
            else if (this.transformType == 'qq') {
                playerSet = inverseQQTransformMulti(playerSet, BOUND);
                hostSet = inverseQQTransformMulti(playerSet, BOUND);
            }
            else { //
                playerSet = new Set(playerSet);
                hostSet = new Set(hostSet);
            }

            playerOrder.push(playerSet);
            hostOrder.push(hostSet);
        });

        return { playerOrder, hostOrder };
    }

    parseInput(value) {
        return value.split(',')
            .map(n => n.trim())
            .filter(n => n !== '')
            .map(n => parseInt(n))
            .filter(n => !isNaN(n));
    }

    updateOrders() {
        const { playerOrder, hostOrder } = this.getOrderFromInputs();

        this.playerOrder = playerOrder;
        this.hostOrder = hostOrder;
        this.onUpdateConfig();
        this.onOrdersChanged();
        window.weightManager.checkPresetMatch(); // Update status when orders change
    }

    setOrders(playerOrder, hostOrder) {
        // Clear existing rows
        this.tbody.innerHTML = '';
        
        // Create new rows for each height
        const maxHeight = Math.max(playerOrder.length, hostOrder.length);
        for (let i = 0; i < maxHeight; i++) {
            const row = this.createRow(i);
            this.tbody.appendChild(row);
            
            const playerInput = row.querySelector('.player-set');
            const hostInput = row.querySelector('.host-set');
            
            if (i < playerOrder.length) {
                const playerValues = Array.from(playerOrder[i]).map(v => transformValue(v, this.transformType));
                playerInput.value = Array.from(new Set(playerValues)).sort((a, b) => a - b).join(',');
            }
            if (i < hostOrder.length) {
                const hostValues = Array.from(hostOrder[i]).map(v => transformValue(v, this.transformType));
                hostInput.value = Array.from(new Set(hostValues)).sort((a, b) => a - b).join(',');
            }
            
            this.setupRowListeners(row);
        }
        
        this.playerOrder = playerOrder;
        this.hostOrder = hostOrder;
        this.onUpdateConfig();
        this.onOrdersChanged();
    }

    onUpdateConfig = () => {
        // Save config on orders change
        const config = getConfiguration();
        const params = new URLSearchParams();
        params.set('config', JSON.stringify(config));
        
        const url = `${window.location.href.split('?')[0]}?${params.toString()}`;
        history.replaceState(null, '', url);
    }

    onOrdersChanged = () => {
        // This will be set from outside
    }
}

class WeightsTable {
    constructor(weightManager) {
        this.weightManager = weightManager;
        this.tbody = document.getElementById('weights-body');
        this.defaultInput = document.getElementById('default-weight');
        
        this.defaultInput.value = this.weightManager.defaultWeight;
        this.defaultInput.addEventListener('input', () => {
            const value = parseInt(this.defaultInput.value) || 2;
            this.weightManager.setDefaultWeight(value);
            this.render();
            this.onWeightsChanged();
        });
        
        this.render();
    }

    createWeightRow(value, weight, isNew = false) {
        const tr = document.createElement('tr');
        tr.className = 'transition-colors hover:bg-gray-700/50';
        
        tr.innerHTML = `
            <td class="table-cell">
                <input type="number" value="${value}" min="0" max="9" step="1"
                       class="input-box w-full text-center value-input"
                       ${!isNew ? 'readonly' : ''}>
            </td>
            <td class="table-cell">
                <input type="number" value="${weight}" step="any"
                       class="input-box w-full text-center weight-input">
            </td>
            <td class="table-cell text-center">
                <button class="text-red-500 hover:text-red-400 transition-colors delete-weight">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        
        const valueInput = tr.querySelector('.value-input');
        const weightInput = tr.querySelector('.weight-input');
        const deleteBtn = tr.querySelector('.delete-weight');
        
        // Preserve focus state
        let isFocused = false;
        weightInput.addEventListener('focus', () => { isFocused = true; });
        weightInput.addEventListener('blur', () => { isFocused = false; });
        
        const updateWeight = () => {
            const newValue = parseInt(valueInput.value);
            const newWeight = weightInput.value === '' ? this.weightManager.defaultWeight 
                                                     : parseFloat(weightInput.value);
            
            if (!isNaN(newValue) && newValue >= 0 && newValue <= 9) {
                // Only update if the value actually changed
                    this.weightManager.setWeight(newValue, newWeight);
                    this.onWeightsChanged();
            }
        };
        
        valueInput.addEventListener('input', updateWeight);
        weightInput.addEventListener('input', () => {
            updateWeight();
            // Don't re-render if the weight is empty/default and this is a preset row
           
                this.render();
                // if (isFocused) {
                //     tr.querySelector('.weight-input').focus();
                // }
        });
        
        deleteBtn.addEventListener('click', () => {
            tr.remove();
            this.onWeightsChanged();
        });
        
        return tr;
    }

    getHighestValue() {
        let max = -1;
        this.tbody.querySelectorAll('.value-input').forEach(input => {
            const value = parseInt(input.value);
            if (!isNaN(value)) {
                max = Math.max(max, value);
            }
        });
        return max;
    }

    render() {
        // Clear the entire table
        this.tbody.innerHTML = '';

        // Add rows for weights from the weight manager
        for (const [value, weight] of this.weightManager.weights.entries()) {
            const row = this.createWeightRow(value, weight, false);
            this.tbody.appendChild(row);
        }

        // Add single "Add Extra Weight" row at the bottom
        const addRow = document.createElement('tr');
        addRow.className = 'add-weight-row';  // Add a class for easy identification
        addRow.innerHTML = `
            <td colspan="3" class="table-cell text-center">
                <button class="text-primary hover:text-primary/80 transition-colors">
                    <i class="fas fa-plus mr-2"></i>Add Extra Weight
                </button>
            </td>
        `;
        
        addRow.querySelector('button').addEventListener('click', () => {
            const nextValue = Math.min(9, this.getHighestValue() + 1);
            const row = this.createWeightRow(nextValue, this.weightManager.defaultWeight, true);
            this.tbody.insertBefore(row, addRow);
        });
        
        this.tbody.appendChild(addRow);
    }

    onWeightsChanged = () => {
        // This will be set from outside
        if (window.weightManager) {
            window.weightManager.checkPresetMatch();
        }
    }
}

// Results display
class ResultsDisplay {
    constructor() {
        this.slider = document.getElementById('rounds-slider');
        this.input = document.getElementById('rounds-input');
        this.setupListeners();
    }

    setupListeners() {
        this.slider.addEventListener('input', () => {
            this.input.value = this.slider.value;
            this.onRoundsChanged();
        });

        this.input.addEventListener('input', () => {
            let value = parseInt(this.input.value) || 1;
            if (value < 1) value = 1;
            this.input.value = value;
            if (value <= 4) {
                this.slider.value = value;
            }
            this.onRoundsChanged();
        });
    }

    update(ev) {
        const rounds = parseInt(this.input.value) || 1;
        const edge = getEdge(ev, rounds);
        const roundedEv = Math.pow(ev, rounds);
        const rtp = (roundedEv * 100).toFixed(2) + '%';
        
        document.getElementById('ev-value').textContent = roundedEv.toFixed(4);
        document.getElementById('rtp-value').textContent = rtp;
        document.getElementById('edge-value').textContent = (edge * 100).toFixed(2) + '%';

        // Hide error elements
        document.getElementById('result-error-div').hidden = true;
        document.getElementById('result-error-label').hidden = true;
        document.getElementById('result-error').hidden = true;
    }

    error(ev) {
        document.getElementById('ev-value').textContent = '???';
        document.getElementById('rtp-value').textContent = '???';
        document.getElementById('edge-value').textContent = '???';

        // Unhide elements

        document.getElementById('result-error-div').hidden = false;
        document.getElementById('result-error-label').hidden = false;
        
        const errorElem = document.getElementById('result-error');
        errorElem.hidden = false;
        errorElem.textContent = ev.message;
    }

    onRoundsChanged = () => {
        // This will be set from outside
    }
}

// Configuration sharing
function getConfiguration() {
    const weightManager = window.weightManager;
    const ordersManager = window.ordersManager;
    const transformSelect = document.getElementById('transform-type');

    const config = {
        mode: transformSelect.value,
        weights: weightManager.getConfiguration(),
        orders: {
            player: ordersManager.playerOrder.map(set => Array.from(set)),
            host: ordersManager.hostOrder.map(set => Array.from(set))
        }
    };

    return config;
}

function loadConfiguration(config) {
    if (!config) return;

    const transformSelect = document.getElementById('transform-type');
    transformSelect.value = config.mode || 'xeme';

    if (config.weights) {
        window.weightManager.loadConfiguration(config.weights);
        window.weightsTable.render();
    }

    if (config.orders) {
        const playerOrder = config.orders.player.map(arr => new Set(arr));
        const hostOrder = config.orders.host.map(arr => new Set(arr));
        window.ordersManager.setOrders(playerOrder, hostOrder);
    }
}

// Initialize the calculator
document.addEventListener('DOMContentLoaded', () => {
    const weightManager = new WeightManager();
    const ordersManager = new OrdersManager(weightManager);
    const weightsTable = new WeightsTable(weightManager);
    const resultsDisplay = new ResultsDisplay();
    const transformSelect = document.getElementById('transform-type'); // Xeme or QQ
    const displaySelect = document.getElementById('display-type'); // Fixed or raw
    
    // Make instances available globally for configuration sharing
    window.weightManager = weightManager;
    window.ordersManager = ordersManager;
    window.weightsTable = weightsTable;
    
    function updateCalculations() {
        try {
            const weightFunc = (num) => weightManager.getWeight(num, transformSelect.value);
            const ev = getEV(ordersManager.playerOrder, ordersManager.hostOrder, weightFunc, BOUND);
            resultsDisplay.update(ev);
        } catch (e) {
            console.error('Calculation error:', e);
            resultsDisplay.error(e);
        }
    }
    
    // Connect all the update handlers
    ordersManager.onOrdersChanged = updateCalculations;
    weightsTable.onWeightsChanged = updateCalculations;
    resultsDisplay.onRoundsChanged = updateCalculations;
    transformSelect.addEventListener('change', () => {
        ordersManager.transformType = transformSelect.value;
        if (displaySelect.value === 'raw') {
            updateDisplayMode();
        }
        updateCalculations();
    });
    
    // Handle display mode changes
    function updateDisplayMode() {
        const isRaw = displaySelect.value === 'raw';
        document.querySelectorAll('.player-set, .host-set').forEach(input => {
            const isPlayer = input.classList.contains('player-set');
            const height = parseInt(input.closest('tr').cells[0].textContent);
            const set = isPlayer ? ordersManager.playerOrder[height] : ordersManager.hostOrder[height];

            if (isRaw) {
                // Show raw values
                input.value = Array.from(set).sort((a, b) => a - b).join(',');
            } else {
                // Show transformed values
                const transformedValues = Array.from(set)
                    .map(v => transformValue(v, transformSelect.value))
                    .filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
                    .sort((a, b) => a - b);
                input.value = transformedValues.join(',');
            }
            
            // Make readonly in raw mode
            input.readOnly = isRaw;
            input.style.opacity = isRaw ? '0.7' : '1';
        });
    }
    
    displaySelect.addEventListener('change', updateDisplayMode);
    
    // Handle presets
    const gameSelect = document.getElementById('game-type');
    const loadPresetBtn = document.getElementById('load-preset');
    
    loadPresetBtn.addEventListener('click', () => {
        const game = gameSelect.value;
        const preset = gamePresets[game];
        
        weightManager.loadPreset(game);
        weightsTable.render();
        
        ordersManager.setOrders(preset.player(), preset.host());
    });

    // Handle configuration sharing
    const shareBtn = document.getElementById('share-config');
    shareBtn.addEventListener('click', () => {
        const config = getConfiguration();
        const params = new URLSearchParams();
        params.set('config', JSON.stringify(config));
        
        const url = `${window.location.href.split('?')[0]}?${params.toString()}`;
        navigator.clipboard.writeText(url).then(() => {
            const originalText = shareBtn.innerHTML;
            shareBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Copied!';
            setTimeout(() => {
                shareBtn.innerHTML = originalText;
            }, 2000);
        });
    });

    // Check for configuration in URL
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');
    if (configParam) {
        try {
            const config = JSON.parse(configParam);
            loadConfiguration(config);
        } catch (e) {
            console.error('Failed to load configuration:', e);
        }
    } else {
        // Initial load
        loadPresetBtn.click();
    }
});