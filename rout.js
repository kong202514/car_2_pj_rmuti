// This code integrates Longdo Map functionality into the existing bus route search system.
// It initializes the map, displays all bus stops as markers, and draws the calculated routes on the map.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// Firebase configuration (replace with your actual config if different)
const firebaseConfig = {
    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",
    authDomain: "qazx-3fc6e.firebaseapp.com",
    projectId: "qazx-3fc6e",
    storageBucket: "qazx-3fc6e.appspot.com",
    messagingSenderId: "101969041040",
    appId: "1:101969041040:web:a578a1b724e1ebf7f9aa15",
    measurementId: "G-8RFTQKJH2Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get DOM elements
const originSelect = document.getElementById('originSelect');
const destinationSelect = document.getElementById('destinationSelect');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('results-container');
const loadingMessage = document.getElementById('loading-message');
// const mapElement = document.getElementById('map'); // Longdo Map element - Removed

// Global data arrays
let allStops = [];
let allRoutes = [];
let allRouteSegments = [];

// Longdo Map instance - Removed
// let map;
// let currentMarkers = []; // To store current markers on the map - Removed
// let currentPolylines = []; // To store current polylines on the map - Removed

/**
 * Populates a dropdown select element with stop data.
 * @param {HTMLSelectElement} selectElement - The select element to populate.
 * @param {Array<Object>} stopsData - An array of stop objects.
 */
function populateDropdown(selectElement, stopsData) {
    // Clear existing options except the first one
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild);
    }
    // Sort stops alphabetically by name (Thai locale)
    stopsData.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    // Add each stop as an option
    stopsData.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop.id;
        option.textContent = stop.name;
        selectElement.appendChild(option);
    });
}

/**
 * Loads all stop data from Firestore.
 */
async function loadAllStopsData() {
    const snapshot = await getDocs(collection(db, 'stops'));
    allStops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


async function loadAllRoutesData() {
    const snapshot = await getDocs(collection(db, 'routes'));
    allRoutes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


async function loadAllRouteSegmentsData() {
    const snapshot = await getDocs(collection(db, 'route_segments'));
    allRouteSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


async function findRoute() {
    resultsContainer.innerHTML = ''; // Clear previous results
    loadingMessage.style.display = 'block'; // Show loading message


    const originId = originSelect.value;
    const destinationId = destinationSelect.value;

    if (!originId || !destinationId || originId === destinationId) {
        loadingMessage.style.display = 'none';
        resultsContainer.innerHTML = '<p style="color:red;">กรุณาเลือกจุดต้นทางและปลายทางที่ไม่ซ้ำกัน</p>';
        return;
    }

    const originStop = allStops.find(s => s.id === originId);
    const destinationStop = allStops.find(s => s.id === destinationId);




    // Find direct routes
    const directRoutes = allRoutes.filter(route => {
        const stopIds = route.stops.map(s => s.stopId);
        return stopIds.includes(originId) && stopIds.includes(destinationId);
    });

    if (directRoutes.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางตรง:</h3>';
        const limitedDirectRoutes = directRoutes.slice(0, 2); // Limit to 2 direct routes
        for (const route of limitedDirectRoutes) {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
            const stopListHtml = sortedStops.map((s, i) => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return `<li>${i + 1}. ${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');

            resultsContainer.innerHTML += `
                <div>
                    <div><b>สาย: ${route.name}</b> - ${route.description || 'ไม่มีคำอธิบาย'}</div>
                    <ol>${stopListHtml}</ol>
                    <div id="svg-route-${route.id}"></div>
                    <div><b>เส้นทางขากลับ:</b></div>
                    <div id="svg-route-reverse-${route.id}"></div>
                </div>`;

            const nodes = sortedStops.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId, lat: stopData?.lat, lon: stopData?.lon };
            });

        }
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางตรง</p>';
    }

    // Find 1-transfer routes
    const transfers1 = [];
    for (const route1 of allRoutes) {
        if (!route1.stops.some(s => s.stopId === originId)) continue;
        for (const route2 of allRoutes) {
            if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destinationId)) continue;
            const transferStopId = route1.stops
                .map(s => s.stopId)
                .find(id => route2.stops.some(s2 => s2.stopId === id) && id !== originId && id !== destinationId);

            if (transferStopId) {
                const transferStop = allStops.find(s => s.id === transferStopId);
                transfers1.push({
                    transferAt: transferStop?.name || transferStopId,
                    route1,
                    route2,
                    transferStopId
                });
            }
        }
    }

    if (transfers1.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (1 จุด):</h3>';
        const limitedTransfers = transfers1.slice(0, 2); // Limit to 2 transfer routes
        limitedTransfers.forEach((t, i) => {
            const stops1 = [...t.route1.stops].sort((a, b) => a.order - b.order);
            const stops2 = [...t.route2.stops].sort((a, b) => a.order - b.order);

            const stopList1 = stops1.map((s) => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === originId ? '✅ ' : (s.stopId === t.transferStopId ? '➡️ ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');

            const stopList2 = stops2.map((s) => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === t.transferStopId ? '➡️ ' : (s.stopId === destinationId ? '🏁 ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');

            resultsContainer.innerHTML += `
                <div>
                    <div><b>แผนการเดินทางที่ ${i + 1}</b>: ขึ้นรถสาย ${t.route1.name}</div>
                    มาลงที่ ${t.transferAt}
                    <div>แล้วขึ้นสายที่ ${t.route2.name}</div>
                    <div>สายแรก:</div>
                    <ol>${stopList1}</ol>
                    <div>สายที่สอง:</div>
                    <ol>${stopList2}</ol>
                    <div id="svg-transfer1-${i}"></div>
                    <div id="svg-transfer2-${i}"></div>
                    <div><b>เส้นทางขากลับ:</b></div>
                    <div id="svg-transfer1-rev-${i}"></div>
                    <div id="svg-transfer2-rev-${i}"></div>
                </div>`;

            const nodes1 = stops1.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId, lat: stopData?.lat, lon: stopData?.lon };
            });
            const nodes2 = stops2.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId, lat: stopData?.lat, lon: stopData?.lon };
            });


        });
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ 1 จุด</p>';
    }

    // Find 2-transfer routes
    const transfers2 = [];

    for (const routeA of allRoutes) {
        if (!routeA.stops.some(s => s.stopId === originId)) continue;

        for (const routeB of allRoutes) {
            if (routeB.id === routeA.id) continue;

            for (const routeC of allRoutes) {
                if (routeC.id === routeA.id || routeC.id === routeB.id) continue;
                if (!routeC.stops.some(s => s.stopId === destinationId)) continue;

                // Find 2 transfer points
                const transferStop1 = routeA.stops
                    .map(s => s.stopId)
                    .find(id => routeB.stops.some(s2 => s2.stopId === id) && id !== originId && id !== destinationId);
                if (!transferStop1) continue;

                const transferStop2 = routeB.stops
                    .map(s => s.stopId)
                    .find(id => routeC.stops.some(s2 => s2.stopId === id) && id !== originId && id !== destinationId && id !== transferStop1);
                if (!transferStop2) continue;

                // Check correct order of stops (origin -> transfer1 -> transfer2 -> destination)
                const originOrder = routeA.stops.find(s => s.stopId === originId)?.order ?? -1;
                const transfer1OrderInA = routeA.stops.find(s => s.stopId === transferStop1)?.order ?? -1;
                if (transfer1OrderInA <= originOrder) continue;

                const transfer1OrderInB = routeB.stops.find(s => s.stopId === transferStop1)?.order ?? -1;
                const transfer2OrderInB = routeB.stops.find(s => s.stopId === transferStop2)?.order ?? -1;
                if (transfer2OrderInB <= transfer1OrderInB) continue;

                const transfer2OrderInC = routeC.stops.find(s => s.stopId === transferStop2)?.order ?? -1;
                const destinationOrderInC = routeC.stops.find(s => s.stopId === destinationId)?.order ?? -1;
                if (destinationOrderInC <= transfer2OrderInC) continue;

                transfers2.push({
                    routeA,
                    routeB,
                    routeC,
                    transferStop1,
                    transferStop2,
                    transferAt1: allStops.find(s => s.id === transferStop1)?.name || transferStop1,
                    transferAt2: allStops.find(s => s.id === transferStop2)?.name || transferStop2
                });
            }
        }
    }

    if (transfers2.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (2 จุด):</h3>';
        const limitedTransfers2 = transfers2.slice(0, 1); // Limit to 1 two-transfer route
        limitedTransfers2.forEach((t, i) => {
            const stopsA = [...t.routeA.stops].sort((a, b) => a.order - b.order);
            const stopsB = [...t.routeB.stops].sort((a, b) => a.order - b.order);
            const stopsC = [...t.routeC.stops].sort((a, b) => a.order - b.order);

            // Create stop list with highlights for origin, transfer, destination
            const stopListA = stopsA.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === originId ? '✅ ' : (s.stopId === t.transferStop1 ? '➡️ ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');

            const stopListB = stopsB.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === t.transferStop1 ? '➡️ ' : (s.stopId === t.transferStop2 ? '➡️ ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');

            const stopListC = stopsC.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === t.transferStop2 ? '➡️ ' : (s.stopId === destinationId ? '🏁 ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');

            resultsContainer.innerHTML += `
                <div>
                    <div><b>แผนการเดินทางที่ ${i + 1}</b> ต่อรถ 2 จุด:</div>
                    <div>ขึ้นรถสาย ${t.routeA.name} → ลงที่ ${t.transferAt1}</div>
                    <div>ต่อรถสาย ${t.routeB.name} → ลงที่ ${t.transferAt2}</div>
                    <div>ต่อรถสาย ${t.routeC.name} → ถึงปลายทาง</div>

                    <div>สายแรก:</div>
                    <ol>${stopListA}</ol>
                    <div>สายที่สอง:</div>
                    <ol>${stopListB}</ol>
                    <div>สายที่สาม:</div>
                    <ol>${stopListC}</ol>

                    <div id="svg-transfer3-1-${i}"></div>
                    <div id="svg-transfer3-2-${i}"></div>
                    <div id="svg-transfer3-3-${i}"></div>
                    <div><b>เส้นทางขากลับ:</b></div>
                    <div id="svg-transfer3-1-rev-${i}"></div>
                    <div id="svg-transfer3-2-rev-${i}"></div>
                    <div id="svg-transfer3-3-rev-${i}"></div>
                </div>
            `;

            const nodesA = stopsA.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId, lat: stopData?.lat, lon: stopData?.lon };
            });
            const nodesB = stopsB.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId, lat: stopData?.lat, lon: stopData?.lon };
            });
            const nodesC = stopsC.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId, lat: stopData?.lat, lon: stopData?.lon };
            });


        });
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ 2 จุด</p>';
    }

    loadingMessage.style.display = 'none'; // Hide loading message
}

// Attach event listener to the search button
searchButton.addEventListener('click', findRoute);


async function initApp() {

    const snapshot = await getDocs(collection(db, 'stops'));
    let allStops2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(allStops2[56].latitude);

    // console.log(allStops2);
    // console.log(allStops2[56].latitude, allStops2[56].longitude);




    loadingMessage.style.display = 'block'; // Show loading message
    searchButton.disabled = true; // Disable button while loading

    await Promise.all([loadAllStopsData(), loadAllRoutesData(), loadAllRouteSegmentsData()]);
    populateDropdown(originSelect, allStops);
    populateDropdown(destinationSelect, allStops);
    var map = new longdo.Map({
        placeholder: document.getElementById('map')
    });
   

    // Add markers for all stops in allStops2
    for (let i = 0; i < allStops2.length; i++) {
        const stop = allStops2[i];
        if (stop.latitude && stop.longitude) {
            const marker = new longdo.Marker({
                lon: stop.longitude,
                lat: stop.latitude,
            }, {
                title: stop.name || `จุดที่ ${i + 1}`,
                detail: stop.name || ''
            });
            map.Overlays.add(marker);
        }
    }

    // var locationList = [
    //     { lon: 100, lat: 20 },
    //     { lon: 100, lat: 6 }
    // ];
    // var geom = new longdo.Polyline(locationList);
    // map.Overlays.add(geom);


    map.zoom(15, true);





    loadingMessage.style.display = 'none'; // Hide loading message
    searchButton.disabled = false; // Enable button once everything is loaded
}

// Initialize the application when the window loads
window.onload = initApp;