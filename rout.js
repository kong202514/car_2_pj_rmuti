// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",
    authDomain: "qazx-3fc6e.firebaseapp.com",
    projectId: "qazx-3fc6e",
    storageBucket: "qazx-3fc6e.firebasestorage.app",
    messagingSenderId: "101969041040",
    appId: "1:101969041040:web:a578a1b724e1ebf7f9aa15",
    measurementId: "G-8RFTQKJH2Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// New class to handle all route-related logic
class RouteFinder {
    constructor(uiElements) {
        this.ui = uiElements;
        this.stops = [];
        this.routes = [];
        this.routeSegments = [];
    }

    // Initialize the application: load data and set up event listeners
    async init() {
        this.ui.loadingMessage.style.display = 'block';
        await this.loadData();
        this.populateDropdowns();
        this.setupEventListeners();
        this.ui.loadingMessage.style.display = 'none';
    }

    // Load data from Firebase
    async loadData() {
        const [stopsSnapshot, routesSnapshot, segmentsSnapshot] = await Promise.all([
            getDocs(collection(db, 'stops')),
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'route_segments'))
        ]);
        this.stops = stopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.routes = routesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.routeSegments = segmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Populate the dropdown menus with stop data
    populateDropdowns() {
        const sortedStops = [...this.stops].sort((a, b) => a.name.localeCompare(b.name, 'th'));
        this.populateDropdown(this.ui.originSelect, sortedStops);
        this.populateDropdown(this.ui.destinationSelect, sortedStops);
    }

    populateDropdown(selectElement, stopsData) {
        selectElement.innerHTML = '<option value="">เลือกจุด</option>';
        stopsData.forEach(stop => {
            const option = document.createElement('option');
            option.value = stop.id;
            option.textContent = stop.name;
            selectElement.appendChild(option);
        });
    }

    // Set up event listeners for buttons
    setupEventListeners() {
        this.ui.searchButton.addEventListener('click', () => this.findRoute());
        this.ui.showAllRoutesButton.addEventListener('click', () => this.showAllRoutes());
    }

    // Main method to find and display routes
    findRoute() {
        this.ui.resultsContainer.innerHTML = '';
        this.ui.loadingMessage.style.display = 'block';

        const origin = this.ui.originSelect.value;
        const destination = this.ui.destinationSelect.value;

        if (!origin || !destination || origin === destination) {
            this.ui.loadingMessage.style.display = 'none';
            this.ui.resultsContainer.innerHTML = '<p class="text-error">กรุณาเลือกจุดต้นทางและปลายทางที่ไม่ซ้ำกัน</p>';
            return;
        }

        this.displayDirectRoutes(origin, destination);
        this.displayTransferRoutes(origin, destination);

        this.ui.loadingMessage.style.display = 'none';
    }

    // Display direct routes
    displayDirectRoutes(origin, destination) {
        const directRoutes = this.routes.filter(route => {
            const stopIds = route.stops.map(s => s.stopId);
            return stopIds.includes(origin) && stopIds.includes(destination);
        });

        if (directRoutes.length > 0) {
            let directHtml = '<div class="result-section"><h3><i class="fa-solid fa-arrow-right-long" style="color: #2ecc71;"></i> เส้นทางตรง:</h3>';
            directRoutes.forEach(route => {
                const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
                const stopListHtml = sortedStops.map(s => {
                    const stopData = this.stops.find(stop => stop.id === s.stopId);
                    const stopName = stopData ? stopData.name : s.stopId;
                    let icon = '<i class="fa-solid fa-circle-dot" style="color: #5cacee;"></i>';
                    if (s.stopId === origin) {
                        icon = '<i class="fa-solid fa-location-dot" style="color: #e74c3c;"></i>';
                    } else if (s.stopId === destination) {
                        icon = '<i class="fa-solid fa-flag-checkered" style="color: #27ae60;"></i>';
                    }
                    return `<li class="route-stop-item">${icon} ${stopName}</li>`;
                }).join('');

                directHtml += `
                    <div class="result-card">
                        <div class="card-header">
                            <h4>สาย: ${route.name}</h4>
                            <p class="description">${route.description || 'ไม่มีคำอธิบาย'}</p>
                        </div>
                        <div class="card-body">
                            <ul class="route-stop-list">
                                ${stopListHtml}
                            </ul>
                        </div>
                    </div>`;
            });
            directHtml += '</div>';
            this.ui.resultsContainer.innerHTML += directHtml;
        } else {
            this.ui.resultsContainer.innerHTML += '<p class="text-info">ไม่พบเส้นทางตรง</p>';
        }
    }

    // Display transfer routes
    displayTransferRoutes(origin, destination) {
        const transfers = [];
        for (const route1 of this.routes) {
            if (!route1.stops.some(s => s.stopId === origin)) continue;

            for (const route2 of this.routes) {
                if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destination)) continue;

                const transferStopId = route1.stops
                    .map(s => s.stopId)
                    .find(id => route2.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination);

                if (transferStopId) {
                    const transferStop = this.stops.find(s => s.id === transferStopId);
                    transfers.push({
                        transferAt: transferStop?.name || transferStopId,
                        route1,
                        route2,
                        transferStopId
                    });
                }
            }
        }

        if (transfers.length > 0) {
            let transferHtml = '<div class="result-section"><h3><i class="fa-solid fa-right-left" style="color: #ff7f50;"></i> เส้นทางต่อรถ (1 จุด):</h3>';
            transfers.forEach((t, i) => {
                const originStopName = this.stops.find(s => s.id === origin)?.name || origin;
                const destStopName = this.stops.find(s => s.id === destination)?.name || destination;

                const gradientColors = [
                    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                    'linear-gradient(135deg, #a6c1ee 0%, #fbc2eb 100%)',
                    'linear-gradient(135deg, #a5d299 0%, #f77062 100%)',
                    'linear-gradient(135deg, #fbc8d4 0%, #b2fcfd 100%)',
                    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
                ];
                const bgGradient = gradientColors[i % gradientColors.length];

                transferHtml += `
                    <div class="transfer-card" style="background: ${bgGradient};">
                        <h4><i class="fa-solid fa-exchange-alt"></i> แผนการเดินทางที่ ${i + 1}</h4>
                        <div class="transfer-step">
                            <i class="fa-solid fa-bus-simple"></i>
                            <p>ขึ้นรถสาย <strong>${t.route1.name}</strong> จาก <strong>${originStopName}</strong></p>
                        </div>
                        <div class="transfer-step">
                            <i class="fa-solid fa-location-arrow"></i>
                            <p>ไปลงที่ <strong>${t.transferAt}</strong> เพื่อต่อรถ</p>
                        </div>
                        <div class="transfer-step">
                            <i class="fa-solid fa-bus-simple"></i>
                            <p>เปลี่ยนไปขึ้นรถสาย <strong>${t.route2.name}</strong> จาก <strong>${t.transferAt}</strong></p>
                        </div>
                        <div class="transfer-step">
                            <i class="fa-solid fa-flag-checkered"></i>
                            <p>ไปยังปลายทาง <strong>${destStopName}</strong></p>
                        </div>
                    </div>`;
            });
            transferHtml += '</div>';
            this.ui.resultsContainer.innerHTML += transferHtml;
        } else {
            this.ui.resultsContainer.innerHTML += '<p class="text-info">ไม่พบเส้นทางต่อรถ</p>';
        }
    }

    // Display all available routes
    showAllRoutes() {
        this.ui.resultsContainer.innerHTML = '';
        this.ui.loadingMessage.style.display = 'block';

        if (this.routes.length === 0) {
            this.ui.resultsContainer.innerHTML = '<p class="text-info">ไม่พบข้อมูลเส้นทางรถสองแถว</p>';
            this.ui.loadingMessage.style.display = 'none';
            return;
        }

        let allRoutesHtml = `
        <div class="result-section">
            <h3><i class="fa-solid fa-road" style="color: #2ecc71;"></i> รายละเอียดเส้นทางทั้งหมด:</h3>
            <div class="routes-grid-container">`; // New grid container

        this.routes.forEach(route => {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
            const stopListHtml = sortedStops.map(s => {
                const stopData = this.stops.find(stop => stop.id === s.stopId);
                const stopName = stopData ? stopData.name : s.stopId;
                return `
                <li class="stop-list-item">
                    <i class="fa-solid fa-bus-simple" style="color: #5cacee;"></i> ${stopName}
                </li>`;
            }).join('');

            allRoutesHtml += `
            <div class="result-card">
                <div class="card-header">
                    <h4>สาย: ${route.name}</h4>
                    <p class="description">${route.description || 'ไม่มีคำอธิบาย'}</p>
                </div>
                <div class="card-body">
                    <ul class="stop-list">
                        ${stopListHtml}
                    </ul>
                </div>
            </div>`;
        });

        allRoutesHtml += `
            </div>
        </div>`; // Close the new grid container
        this.ui.resultsContainer.innerHTML = allRoutesHtml;
        this.ui.loadingMessage.style.display = 'none';
    }
}

// Get DOM elements and create an instance of the class
document.addEventListener('DOMContentLoaded', () => {
    const uiElements = {
        originSelect: document.getElementById('originSelect'),
        destinationSelect: document.getElementById('destinationSelect'),
        searchButton: document.getElementById('searchButton'),
        resultsContainer: document.getElementById('results-container'),
        loadingMessage: document.getElementById('loading-message'),
        showAllRoutesButton: document.getElementById('show-all-routes-button')
    };

    const routeFinder = new RouteFinder(uiElements);
    routeFinder.init();
});
