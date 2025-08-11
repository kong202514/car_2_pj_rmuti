 // This code integrates Longdo Map functionality into the existing bus route search system.
// It initializes the map, displays all bus stops as markers, and draws the calculated routes on the map.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// Firebase configuration
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
const routeButtonsContainer = document.getElementById('route-buttons');
const showAllRoutesButton = document.getElementById('show-all-routes-button');

// Global data arrays and map variables
let allStops = [];
let allRoutes = [];
let map;
let currentMarkers = [];
let currentPolylines = [];

function populateDropdown(selectElement, stopsData) {
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild);
    }
    stopsData.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    stopsData.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop.id;
        option.textContent = stop.name;
        selectElement.appendChild(option);
    });
}

async function loadAllStopsData() {
    const snapshot = await getDocs(collection(db, 'stops'));
    allStops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function loadAllRoutesData() {
    const snapshot = await getDocs(collection(db, 'routes'));
    allRoutes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function clearMapOverlays() {
    currentMarkers.forEach(marker => map.Overlays.remove(marker));
    currentPolylines.forEach(polyline => map.Overlays.remove(polyline));
    currentMarkers = [];
    currentPolylines = [];
}

/**
 * แสดงป้ายรถเมล์และเส้นทางของสายที่เลือกบนแผนที่
 * @param {Array<Object>} routesToDisplay - อาร์เรย์ของเส้นทางที่ต้องการแสดงผล
 * @param {Array<Object>} stopsToDisplay - อาร์เรย์ของป้ายรถเมล์ที่ต้องการแสดงผล
 */
function displayOnMap(routesToDisplay = allRoutes, stopsToDisplay = allStops) {
    clearMapOverlays();

    // สร้างและเพิ่ม Marker
    stopsToDisplay.forEach(stop => {
        if (stop.latitude && stop.longitude) {
            const marker = new longdo.Marker({ lon: stop.longitude, lat: stop.latitude }, { title: stop.name, detail: stop.name });
            map.Overlays.add(marker);
            currentMarkers.push(marker);
        }
    });

    // สร้างและเพิ่ม Polyline
    routesToDisplay.forEach(route => {
        const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
        const polyline = new longdo.Polyline({
            color: longdo.Color.random(),
            weight: 5
        });

        sortedStops.forEach(stopInRoute => {
            const stopData = allStops.find(s => s.id === stopInRoute.stopId);
            if (stopData && stopData.latitude && stopData.longitude) {
                polyline.addLatLng(new longdo.LatLng(stopData.latitude, stopData.longitude));
            }
        });

        map.Overlays.add(polyline);
        currentPolylines.push(polyline);
    });

    // ปรับมุมมองแผนที่
    if (stopsToDisplay.length > 0) {
        const bounds = new longdo.Bounds();
        stopsToDisplay.forEach(stop => bounds.extend(new longdo.LatLng(stop.latitude, stop.longitude)));
        map.Bound(bounds);
    }
}

function createRouteButtons() {
    allRoutes.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    allRoutes.forEach(route => {
        const button = document.createElement('button');
        button.textContent = `สาย ${route.name}`;
        button.addEventListener('click', () => {
            resultsContainer.innerHTML = '';
            const stopsInRoute = allStops.filter(s => route.stops.map(stop => stop.stopId).includes(s.id));
            displayOnMap([route], stopsInRoute);
        });
        routeButtonsContainer.appendChild(button);
    });

    showAllRoutesButton.addEventListener('click', () => {
        resultsContainer.innerHTML = '';
        displayOnMap();
    });
}

async function findRoute() {
    resultsContainer.innerHTML = '';
    loadingMessage.style.display = 'block';

    const originId = originSelect.value;
    const destinationId = destinationSelect.value;

    if (!originId || !destinationId || originId === destinationId) {
        loadingMessage.style.display = 'none';
        resultsContainer.innerHTML = '<p style="color:red;">กรุณาเลือกจุดต้นทางและปลายทางที่ไม่ซ้ำกัน</p>';
        return;
    }

    clearMapOverlays();

    let foundRoutes = [];
    let stopsForMap = [];

    const originStop = allStops.find(s => s.id === originId);
    const destinationStop = allStops.find(s => s.id === destinationId);
    if (originStop) stopsForMap.push(originStop);
    if (destinationStop) stopsForMap.push(destinationStop);

    // Find direct routes
    const directRoutes = allRoutes.filter(route => {
        const stopIds = route.stops.map(s => s.stopId);
        return stopIds.includes(originId) && stopIds.includes(destinationId);
    });

    if (directRoutes.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางตรง:</h3>';
        directRoutes.slice(0, 2).forEach(route => {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
            const stopListHtml = sortedStops.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                return `<li>${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');
            resultsContainer.innerHTML += `<div><b>สาย: ${route.name}</b> - ${route.description || 'ไม่มีคำอธิบาย'}<ol>${stopListHtml}</ol></div>`;

            foundRoutes.push(route);
            stopsForMap.push(...sortedStops.map(s => allStops.find(stop => stop.id === s.stopId)));
        });
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางตรง</p>';
    }

    // Find 1-transfer routes
    const transfers1 = [];
    for (const route1 of allRoutes) {
        // ตรวจสอบว่าเส้นทาง 1 มีจุดเริ่มต้นหรือไม่
        if (!route1.stops.some(s => s.stopId === originId)) continue;
        for (const route2 of allRoutes) {
            // ตรวจสอบว่าเส้นทาง 2 มีจุดปลายทางหรือไม่
            if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destinationId)) continue;
            // หาจุดต่อรถ
            const transferStopId = route1.stops.map(s => s.stopId).find(id => route2.stops.some(s2 => s2.stopId === id) && id !== originId && id !== destinationId);
            if (transferStopId) {
                // ตรวจสอบลำดับของป้ายในเส้นทาง 1
                const originOrder = route1.stops.find(s => s.stopId === originId)?.order ?? -1;
                const transferOrder1 = route1.stops.find(s => s.stopId === transferStopId)?.order ?? -1;
                // ตรวจสอบลำดับของป้ายในเส้นทาง 2
                const transferOrder2 = route2.stops.find(s => s.stopId === transferStopId)?.order ?? -1;
                const destinationOrder = route2.stops.find(s => s.stopId === destinationId)?.order ?? -1;

                // ตรวจสอบว่าจุดต่อรถอยู่หลังจากจุดเริ่มต้น และจุดปลายทางอยู่หลังจากจุดต่อรถ
                if (transferOrder1 > originOrder && destinationOrder > transferOrder2) {
                    const transferStop = allStops.find(s => s.id === transferStopId);
                    transfers1.push({ transferAt: transferStop?.name || transferStopId, route1, route2, transferStopId });
                }
            }
        }
    }

    if (transfers1.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (1 จุด):</h3>';
        transfers1.slice(0, 2).forEach((t, i) => {
            const stops1 = [...t.route1.stops].sort((a, b) => a.order - b.order);
            const stops2 = [...t.route2.stops].sort((a, b) => a.order - b.order);
            const stopList1 = stops1.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === originId ? '✅ ' : (s.stopId === t.transferStopId ? '➡️ ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');
            const stopList2 = stops2.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId);
                const mark = s.stopId === t.transferStopId ? '➡️ ' : (s.stopId === destinationId ? '🏁 ' : '');
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`;
            }).join('');
            resultsContainer.innerHTML += `<div><b>แผนการเดินทางที่ ${i + 1}</b>: ขึ้นรถสาย ${t.route1.name} มาลงที่ ${t.transferAt} แล้วขึ้นสายที่ ${t.route2.name}<br>สายแรก:<ol>${stopList1}</ol>สายที่สอง:<ol>${stopList2}</ol></div>`;

            foundRoutes.push(t.route1, t.route2);
            stopsForMap.push(...stops1.map(s => allStops.find(stop => stop.id === s.stopId)), ...stops2.map(s => allStops.find(stop => stop.id === s.stopId)));
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

                // ตรวจสอบว่า routeA มีจุดต่อรถไป routeB
                const transferStop1 = routeA.stops.map(s => s.stopId).find(id => routeB.stops.some(s2 => s2.stopId === id) && id !== originId && id !== destinationId);
                if (!transferStop1) continue;

                // ตรวจสอบว่า routeB มีจุดต่อรถไป routeC
                const transferStop2 = routeB.stops.map(s => s.stopId).find(id => routeC.stops.some(s2 => s2.stopId === id) && id !== originId && id !== destinationId && id !== transferStop1);
                if (!transferStop2) continue;

                // ตรวจสอบลำดับการเดินทาง
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
        transfers2.slice(0, 1).forEach((t, i) => {
            const stopsA = [...t.routeA.stops].sort((a, b) => a.order - b.order);
            const stopsB = [...t.routeB.stops].sort((a, b) => a.order - b.order);
            const stopsC = [...t.routeC.stops].sort((a, b) => a.order - b.order);

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
                    <div><b>แผนการเดินทางที่ ${i + 1}</b>: ขึ้นรถสาย ${t.routeA.name} → ลงที่ ${t.transferAt1}</div>
                    <div>ต่อรถสาย ${t.routeB.name} → ลงที่ ${t.transferAt2}</div>
                    <div>ต่อรถสาย ${t.routeC.name} → ถึงปลายทาง</div>
                    <div>สายแรก:</div>
                    <ol>${stopListA}</ol>
                    <div>สายที่สอง:</div>
                    <ol>${stopListB}</ol>
                    <div>สายที่สาม:</div>
                    <ol>${stopListC}</ol>
                </div>
            `;

            foundRoutes.push(t.routeA, t.routeB, t.routeC);
            stopsForMap.push(
                ...stopsA.map(s => allStops.find(stop => stop.id === s.stopId)),
                ...stopsB.map(s => allStops.find(stop => stop.id === s.stopId)),
                ...stopsC.map(s => allStops.find(stop => stop.id === s.stopId))
            );
        });
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ 2 จุด</p>';
    }

    const uniqueStopsForMap = [...new Set(stopsForMap.filter(s => s))];
    const uniqueRoutesForMap = [...new Set(foundRoutes.map(r => r.id))].map(id => allRoutes.find(r => r.id === id));
    displayOnMap(uniqueRoutesForMap, uniqueStopsForMap);

    loadingMessage.style.display = 'none';
}

searchButton.addEventListener('click', findRoute);

async function initApp() {
    loadingMessage.style.display = 'block';


    map = new longdo.Map({
        placeholder: document.getElementById('map')
    });

    await Promise.all([loadAllStopsData(), loadAllRoutesData()]);

    populateDropdown(originSelect, allStops);
    populateDropdown(destinationSelect, allStops);

    createRouteButtons();
    displayOnMap();

    loadingMessage.style.display = 'none';

}

window.onload = initApp;
