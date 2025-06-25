import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// Firebase configuration (แทนที่ด้วยข้อมูลจริงของคุณ)
const firebaseConfig = {
    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",
    authDomain: "qazx-3fc6e.firebaseapp.com",
    projectId: "qazx-3fc6e",
    storageBucket: "qazx-3fc6e.firebasestorage.app",
    messagingSenderId: "101969041040",
    appId: "1:101969041040:web:a578a1b724e1ebf7f9aa15",
    measurementId: "G-8RFTQKJH2Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// References to HTML elements for navigation
const showSearchBtn = document.getElementById('showSearchBtn');
const showAddStopBtn = document.getElementById('showAddStopBtn');
const showManageRoutesBtn = document.getElementById('showManageRoutesBtn');

const searchContainer = document.getElementById('search-container');
const addStopContainer = document.getElementById('add-stop-container');
const manageRoutesContainer = document.getElementById('manage-routes-container');

// Global variables for data
let allStops = [];
let allRoutes = [];
let editingRouteId = null; // Store the ID of the route being edited

// For numeric ID generation
let lastStopId = 0;
let lastRouteId = 0;
let lastSegmentId = 0;

const statusMessageGlobal = document.getElementById('status-message-global');

// --- Helper Functions ---
const showStatusMessage = (message, type, targetElement = statusMessageGlobal) => {
    if (targetElement) {
        targetElement.textContent = message;
        targetElement.className = `status-message status-${type}`;
        targetElement.style.display = 'block';
        setTimeout(() => {
            targetElement.style.display = 'none';
            targetElement.textContent = ''; // Clear message after hiding
        }, 5000); // Hide after 5 seconds
    }
};

const generateNextId = async (collectionName, currentMaxId) => {
    const collectionRef = collection(db, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    let maxId = currentMaxId;

    // Iterate over all documents to find the highest numeric ID
    querySnapshot.forEach(doc => {
        const docId = parseInt(doc.id, 10);
        if (!isNaN(docId) && docId > maxId) {
            maxId = docId;
        }
    });
    return String(maxId + 1);
};

// --- Navigation Functions ---
async function showSection(sectionId) {
    const sections = [searchContainer, addStopContainer, manageRoutesContainer];
    sections.forEach(section => {
        if (section.id === sectionId) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    });
    // Re-load data relevant to the displayed section
    if (sectionId === 'search-container') {
        await loadStopsIntoDropdowns();
    } else if (sectionId === 'add-stop-container') {
        await loadAllStopsForList();
        // Clear add stop form fields
        stopNameInput.value = '';
        stopLatInput.value = '';
        stopLonInput.value = '';
        if (addStopStatus) addStopStatus.textContent = '';
    } else if (sectionId === 'manage-routes-container') {
        await loadAllStopsForRouteForm(); // Load stops for route form selects
        await loadAllRoutesForList(); // Load routes for management list
        clearRouteForm(); // Reset form when navigating to manage routes
    }
    showStatusMessage('', 'success', statusMessageGlobal); // Clear global status on section change
}

showSearchBtn.addEventListener('click', () => showSection('search-container'));
showAddStopBtn.addEventListener('click', () => showSection('add-stop-container'));
showManageRoutesBtn.addEventListener('click', () => showSection('manage-routes-container'));

// Set initial section to search
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize last IDs from existing data first
    lastStopId = parseInt(await generateNextId('stops', 0)) - 1;
    lastRouteId = parseInt(await generateNextId('routes', 0)) - 1;
    lastSegmentId = parseInt(await generateNextId('route_segments', 0)) - 1;
    console.log("Initial IDs - Stop:", lastStopId, "Route:", lastRouteId, "Segment:", lastSegmentId);

    showSection('search-container');
});

// --- Part 1: Search Route Functionality ---
const originSelect = document.getElementById('originSelect');
const destinationSelect = document.getElementById('destinationSelect');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('results-container');
const loadingMessage = document.getElementById('loading-message');

async function loadStopsIntoDropdowns() {
    try {
        const stopsCollectionRef = collection(db, 'stops');
        const querySnapshot = await getDocs(stopsCollectionRef);
        allStops = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        populateDropdown(originSelect, allStops);
        populateDropdown(destinationSelect, allStops);

        console.log("โหลดข้อมูลจุดจอดทั้งหมดและเติมลงใน Dropdown Lists แล้ว");
    } catch (error) {
        console.error("ข้อผิดพลาดในการโหลดจุดจอดและเติม Dropdown Lists:", error);
        resultsContainer.innerHTML = '<p class="no-results">ไม่สามารถโหลดข้อมูลจุดจอดได้ โปรดลองอีกครั้ง</p>';
    }
}

function populateDropdown(selectElement, stopsData) {
    // Clear previous options except the first "เลือก..." option
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild);
    }
    stopsData.sort((a, b) => a.name.localeCompare(b.name, 'th')); // Sort alphabetically
    stopsData.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop.id;
        option.textContent = stop.name;
        selectElement.appendChild(option);
    });
}

async function findRoute() {
    resultsContainer.innerHTML = '';
    loadingMessage.style.display = 'block';

    const originStopId = originSelect.value;
    const destinationStopId = destinationSelect.value;

    if (!originStopId || !destinationStopId) {
        loadingMessage.style.display = 'none';
        showStatusMessage('กรุณาเลือกจุดต้นทางและจุดปลายทาง', 'error', resultsContainer);
        return;
    }

    if (originStopId === destinationStopId) {
        loadingMessage.style.display = 'none';
        showStatusMessage('จุดต้นทางและจุดปลายทางไม่สามารถเป็นจุดเดียวกันได้', 'error', resultsContainer);
        return;
    }

    console.log("ค้นหาเส้นทางจาก:", originStopId, "ไป:", destinationStopId);

    try {
        const routesCollectionRef = collection(db, 'routes');
        const querySnapshot = await getDocs(routesCollectionRef);
        allRoutes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const foundRoutes = [];

        for (const route of allRoutes) {
            const stopsInRoute = route.stops;

            // Ensure stopsInRoute is an array and contains objects with stopId
            if (!Array.isArray(stopsInRoute) || !stopsInRoute.every(s => typeof s === 'object' && 'stopId' in s)) {
                console.warn(`Route ${route.id} has invalid stops data. Skipping.`);
                continue;
            }

            const originStop = stopsInRoute.find(s => s.stopId === originStopId);
            const destinationStop = stopsInRoute.find(s => s.stopId === destinationStopId);

            // Check if both stops exist in the route and the origin comes before the destination
            if (originStop && destinationStop && originStop.order < destinationStop.order) {
                foundRoutes.push(route);
            }
        }

        displayFoundRoutes(foundRoutes, allStops);
    } catch (error) {
        console.error("ข้อผิดพลาดในการค้นหาเส้นทาง:", error);
        showStatusMessage(`เกิดข้อผิดพลาดในการค้นหาเส้นทาง: ${error.message}`, 'error', resultsContainer);
    } finally {
        loadingMessage.style.display = 'none';
    }
}

async function displayFoundRoutes(routes, allStopsData) {
    if (routes.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">ไม่พบเส้นทางตรงที่เชื่อมต่อจุดต้นทางและจุดปลายทาง</p>';
        return;
    }

    resultsContainer.innerHTML = ''; // Clear previous results
    let routeCount = 0;
    for (const route of routes) {
        routeCount++;
        const routeCard = document.createElement('div');
        routeCard.classList.add('route-card');

        const routeName = document.createElement('h3');
        routeName.textContent = `เส้นทางที่ ${routeCount}: ${route.name}`;
        routeCard.appendChild(routeName);

        const routeDescription = document.createElement('p');
        routeDescription.textContent = `รายละเอียด: ${route.description}`;
        routeCard.appendChild(routeDescription);

        const routeColor = document.createElement('p');
        routeColor.textContent = `สี: ${route.color || 'ไม่ระบุ'}`;
        routeCard.appendChild(routeColor);


        const stopListTitle = document.createElement('h4');
        stopListTitle.textContent = 'จุดจอดในเส้นทางนี้:';
        routeCard.appendChild(stopListTitle);

        const stopList = document.createElement('ol');
        stopList.classList.add('stop-list');

        // Ensure stops array is valid and sort it
        const sortedStops = Array.isArray(route.stops) ? [...route.stops].sort((a, b) => a.order - b.order) : [];

        for (const stopRef of sortedStops) {
            const stopId = stopRef.stopId;
            const stopData = allStopsData.find(s => s.id === stopId);

            const stopItem = document.createElement('li');
            if (stopData) {
                stopItem.textContent = stopData.name;
            } else {
                stopItem.textContent = `ไม่พบข้อมูลจุดจอด (ID: ${stopId})`;
                stopItem.style.color = 'red';
            }
            stopList.appendChild(stopItem);
        }
        routeCard.appendChild(stopList);
        resultsContainer.appendChild(routeCard);
    }
}

searchButton.addEventListener('click', findRoute);

// --- Part 2: Add Stop Functionality ---
const stopNameInput = document.getElementById('stopName');
const stopLatInput = document.getElementById('stopLat');
const stopLonInput = document.getElementById('stopLon');
const addStopButton = document.getElementById('addStopButton');
const addStopStatus = document.getElementById('addStopStatus'); // Specific status for add stop form
const allStopsList = document.getElementById('allStopsList');

async function addStop() {
    const name = stopNameInput.value.trim();
    const latitude = parseFloat(stopLatInput.value);
    const longitude = parseFloat(stopLonInput.value);

    if (!name || isNaN(latitude) || isNaN(longitude)) {
        showStatusMessage('กรุณากรอกข้อมูลจุดจอดให้ครบถ้วนและถูกต้อง', 'error', addStopStatus);
        return;
    }

    try {
        const newStopId = await generateNextId('stops', lastStopId);
        const stopsCollection = collection(db, 'stops');
        await setDoc(doc(stopsCollection, newStopId), {
            name: name,
            latitude: latitude,
            longitude: longitude
        });
        showStatusMessage(`เพิ่มจุดจอด "${name}" (ID: ${newStopId}) สำเร็จ!`, 'success', addStopStatus);
        stopNameInput.value = '';
        stopLatInput.value = '';
        stopLonInput.value = '';
        lastStopId = parseInt(newStopId, 10); // Update lastStopId
        await loadAllStopsForList(); // Reload the list
        await loadStopsIntoDropdowns(); // Update search dropdowns as well
        await loadAllStopsForRouteForm(); // Update dropdowns in manage routes section
    } catch (error) {
        console.error("ข้อผิดพลาดในการเพิ่มจุดจอด:", error);
        showStatusMessage(`เกิดข้อผิดพลาดในการเพิ่มจุดจอด: ${error.message}`, 'error', addStopStatus);
    }
}

async function loadAllStopsForList() {
    allStopsList.innerHTML = '<p>กำลังโหลดจุดจอด...</p>';
    try {
        const stopsCollectionRef = collection(db, 'stops');
        const querySnapshot = await getDocs(stopsCollectionRef);
        allStops = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (allStops.length === 0) {
            allStopsList.innerHTML = '<p>ยังไม่มีจุดจอดในระบบ</p>';
            return;
        }

        allStopsList.innerHTML = ''; // Clear message
        allStops.sort((a, b) => a.name.localeCompare(b.name, 'th')); // Sort alphabetically
        allStops.forEach(stop => {
            const stopItemDiv = document.createElement('div');
            stopItemDiv.classList.add('stop-item');
            stopItemDiv.innerHTML = `
                <div class="stop-item-info">
                    <strong>${stop.name}</strong> (ID: ${stop.id})<br>
                    Lat: ${stop.latitude}, Lon: ${stop.longitude}
                </div>
                <div class="stop-item-actions">
                    <button class="danger delete-stop-btn" data-id="${stop.id}">ลบ</button>
                </div>
            `;
            allStopsList.appendChild(stopItemDiv);
        });

        allStopsList.querySelectorAll('.delete-stop-btn').forEach(button => {
            button.addEventListener('click', (event) => deleteStop(event.target.dataset.id));
        });

    } catch (error) {
        console.error("ข้อผิดพลาดในการโหลดจุดจอดทั้งหมด:", error);
        allStopsList.innerHTML = '<p class="no-results">ไม่สามารถโหลดจุดจอดทั้งหมดได้</p>';
    }
}

async function deleteStop(stopId) {
    // if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบจุดจอด ID: ${stopId} นี้? การลบจุดจอดอาจส่งผลต่อเส้นทางที่ใช้งานจุดจอดนี้อยู่`)) {
    //     return;
    // }
    try {
        // Check if any route uses this stop
        const routesUsingStop = allRoutes.filter(route =>
            Array.isArray(route.stops) && route.stops.some(s => s.stopId === stopId)
        );

        if (routesUsingStop.length > 0) {
            const routeNames = routesUsingStop.map(r => r.name).join(', ');
            if (!confirm(`จุดจอดนี้ถูกใช้งานอยู่ในเส้นทาง: ${routeNames} หากลบจุดจอดนี้ เส้นทางเหล่านั้นจะอ้างอิงถึงจุดจอดที่ไม่มีอยู่แล้ว คุณยังต้องการลบหรือไม่?`)) {
                showStatusMessage('ยกเลิกการลบจุดจอด', 'error', addStopStatus);
                return;
            }
        }

        await deleteDoc(doc(db, 'stops', stopId));
        showStatusMessage(`ลบจุดจอด ID: ${stopId} สำเร็จ!`, 'success', addStopStatus);
        await loadAllStopsForList();
        await loadStopsIntoDropdowns();
        await loadAllStopsForRouteForm();
    } catch (error) {
        console.error("ข้อผิดพลาดในการลบจุดจอด:", error);
        showStatusMessage(`เกิดข้อผิดพลาดในการลบจุดจอด: ${error.message}`, 'error', addStopStatus);
    }
}

addStopButton.addEventListener('click', addStop);


// --- Part 3: Manage Routes Functionality ---
const routeNameInput = document.getElementById('routeName');
const routeColorInput = document.getElementById('routeColor');
const routeDescriptionInput = document.getElementById('routeDescription');
const routeStopsContainer = document.getElementById('routeStopsContainer');
const addRouteStopBtn = document.getElementById('addRouteStopBtn');
const saveRouteButton = document.getElementById('saveRouteButton');
const cancelEditRouteButton = document.getElementById('cancelEditRouteButton');
const manageRouteStatus = document.getElementById('manageRouteStatus'); // Specific status for manage route form
const allRoutesList = document.getElementById('allRoutesList');

async function loadAllStopsForRouteForm() {
    // Ensure allStops is loaded before populating selects for route management
    // This also populates global allStops
    await loadStopsIntoDropdowns();
    // Optional: Re-render existing route stops if editing mode is active to refresh dropdowns
    if (editingRouteId) {
        const routeToEdit = allRoutes.find(r => r.id === editingRouteId);
        if (routeToEdit) {
            routeStopsContainer.innerHTML = '';
            routeToEdit.stops.sort((a, b) => a.order - b.order).forEach(stopRef => {
                addRouteStopInput(stopRef.stopId, stopRef.order);
            });
        }
    }
}

function addRouteStopInput(stopId = '', order = '') {
    const div = document.createElement('div');
    div.classList.add('route-stop-entry');
    div.innerHTML = `
        <select class="route-stop-select">
            <option value="">เลือกจุดจอด</option>
            ${allStops.map(stop => `<option value="${stop.id}" ${stop.id === stopId ? 'selected' : ''}>${stop.name}</option>`).join('')}
        </select>
        <input type="number" class="route-stop-order" value="${order}" placeholder="ลำดับ" min="1">
        <button type="button" class="danger remove-route-stop-btn">ลบ</button>
    `;
    routeStopsContainer.appendChild(div);

    div.querySelector('.remove-route-stop-btn').addEventListener('click', () => {
        div.remove();
    });
}

addRouteStopBtn.addEventListener('click', () => addRouteStopInput());

async function saveRoute() {
    const name = routeNameInput.value.trim();
    const color = routeColorInput.value.trim();
    const description = routeDescriptionInput.value.trim();

    const routeStops = [];
    let isValid = true;
    let stopOrderMap = new Map(); // To check for duplicate orders
    let stopIdMap = new Map(); // To check for duplicate stop IDs in the same route

    routeStopsContainer.querySelectorAll('.route-stop-entry').forEach((entry, index) => {
        const select = entry.querySelector('.route-stop-select');
        const orderInput = entry.querySelector('.route-stop-order');

        const stopId = select.value;
        const order = parseInt(orderInput.value);

        if (!stopId || isNaN(order) || order < 1) {
            isValid = false;
            showStatusMessage(`กรุณาเลือกจุดจอดและใส่ลำดับที่ถูกต้องสำหรับจุดจอดลำดับที่ ${index + 1}`, 'error', manageRouteStatus);
            return;
        }
        if (stopOrderMap.has(order)) {
            isValid = false;
            showStatusMessage(`ลำดับ ${order} มีซ้ำกัน กรุณาตรวจสอบ`, 'error', manageRouteStatus);
            return;
        }
        if (stopIdMap.has(stopId)) {
            isValid = false;
            const existingStopName = allStops.find(s => s.id === stopId)?.name || stopId;
            showStatusMessage(`จุดจอด "${existingStopName}" ถูกเลือกซ้ำในเส้นทางเดียวกัน`, 'error', manageRouteStatus);
            return;
        }

        stopOrderMap.set(order, true);
        stopIdMap.set(stopId, true);
        routeStops.push({ stopId: stopId, order: order });
    });

    if (!name || routeStops.length < 2 || !isValid) {
        if (isValid) { // Only show this if isValid is still true
            showStatusMessage('กรุณากรอกชื่อเส้นทางและเพิ่มจุดจอดอย่างน้อย 2 จุด', 'error', manageRouteStatus);
        }
        return;
    }

    try {
        const routeData = {
            name: name,
            color: color,
            description: description,
            stops: routeStops
        };

        let currentRouteId = editingRouteId;

        if (editingRouteId) {
            // Update existing route
            await updateDoc(doc(db, 'routes', editingRouteId), routeData);
            showStatusMessage(`แก้ไขเส้นทาง "${name}" สำเร็จ!`, 'success', manageRouteStatus);
        } else {
            // Add new route
            const newRouteId = await generateNextId('routes', lastRouteId);
            await setDoc(doc(db, 'routes', newRouteId), routeData);
            currentRouteId = newRouteId;
            showStatusMessage(`เพิ่มเส้นทาง "${name}" สำเร็จ! (ID: ${newRouteId})`, 'success', manageRouteStatus);
            lastRouteId = parseInt(newRouteId, 10); // Update lastRouteId
        }

        // --- Regenerate Route Segments for this route ---
        // First, delete old segments for this route
        const segmentsCollection = collection(db, 'route_segments');
        const existingSegmentsSnapshot = await getDocs(segmentsCollection);
        const batch = db.batch(); // Use batch writes for efficiency

        existingSegmentsSnapshot.docs.forEach(segmentDoc => {
            if (segmentDoc.data().routeId === currentRouteId) {
                batch.delete(segmentDoc.ref);
            }
        });

        // Add new segments
        for (let i = 0; i < routeStops.length; i++) {
            for (let j = i + 1; j < routeStops.length; j++) {
                const startStop = routeStops[i];
                const endStop = routeStops[j];

                const newSegmentId = await generateNextId('route_segments', lastSegmentId);
                batch.set(doc(segmentsCollection, newSegmentId), {
                    startStopId: startStop.stopId,
                    endStopId: endStop.stopId,
                    routeId: currentRouteId,
                    routeOrderFrom: startStop.order,
                    routeOrderTo: endStop.order
                });
                lastSegmentId = parseInt(newSegmentId, 10); // Update lastSegmentId
            }
        }
        await batch.commit(); // Commit all batch operations

        showStatusMessage(`ดำเนินการ (เพิ่ม/แก้ไข) สายรถ "${name}" และสร้าง Segments สำเร็จ!`, 'success', manageRouteStatus);
        clearRouteForm();
        await loadAllRoutesForList();
        await loadStopsIntoDropdowns(); // Refresh search dropdowns
    } catch (error) {
        console.error("ข้อผิดพลาดในการบันทึกเส้นทาง:", error);
        showStatusMessage(`เกิดข้อผิดพลาดในการบันทึกเส้นทาง: ${error.message}`, 'error', manageRouteStatus);
    }
    location.reload();
}

async function loadAllRoutesForList() {
    allRoutesList.innerHTML = '<p>กำลังโหลดเส้นทาง...</p>';
    try {
        const routesCollectionRef = collection(db, 'routes');
        const querySnapshot = await getDocs(routesCollectionRef);
        allRoutes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (allRoutes.length === 0) {
            allRoutesList.innerHTML = '<p>ยังไม่มีเส้นทางในระบบ</p>';
            return;
        }

        allRoutesList.innerHTML = ''; // Clear message
        allRoutes.forEach(route => {
            const routeItemDiv = document.createElement('div');
            routeItemDiv.classList.add('route-item');
            routeItemDiv.innerHTML = `
                <div class="route-item-info">
                    <strong>${route.name}</strong> 
                      (ID: ${route.id})
                    <br>
                    สี: <span style="color:${route.color};">${route.color || 'ไม่มี'}</span>, จุดจอด: ${route.stops ? route.stops.length : 0} จุด
                </div>
                <div class="route-item-actions">
                    <button class="secondary edit-route-btn" data-id="${route.id}">แก้ไข</button>
                    <button class="danger delete-route-btn" data-id="${route.id}">ลบ</button>
                </div>
            `
                ;
            allRoutesList.appendChild(routeItemDiv);
        });

        allRoutesList.querySelectorAll('.edit-route-btn').forEach(button => {
            button.addEventListener('click', (event) => editRoute(event.target.dataset.id));
        });
        allRoutesList.querySelectorAll('.delete-route-btn').forEach(button => {
            button.addEventListener('click', (event) => deleteRoute(event.target.dataset.id));
        });

    } catch (error) {
        console.error("ข้อผิดพลาดในการโหลดเส้นทางทั้งหมด:", error);
        allRoutesList.innerHTML = '<p class="no-results">ไม่สามารถโหลดเส้นทางทั้งหมดได้</p>';
    }
}

function editRoute(routeId) {
    const routeToEdit = allRoutes.find(r => r.id === routeId);
    if (!routeToEdit) {
        showStatusMessage('ไม่พบเส้นทางที่ต้องการแก้ไข', 'error', manageRouteStatus);
        return;
    }

    editingRouteId = routeId;
    routeNameInput.value = routeToEdit.name || '';
    routeColorInput.value = routeToEdit.color || '#007bff';
    routeDescriptionInput.value = routeToEdit.description || '';

    routeStopsContainer.innerHTML = ''; // Clear existing stop inputs
    if (Array.isArray(routeToEdit.stops)) {
        routeToEdit.stops.sort((a, b) => a.order - b.order).forEach(stopRef => {
            addRouteStopInput(stopRef.stopId, stopRef.order);
        });
    } else {
        console.warn(`Route ${routeId} has invalid stops data for editing.`);
    }


    saveRouteButton.textContent = 'บันทึกการแก้ไข';
    cancelEditRouteButton.style.display = 'inline-block';
    showStatusMessage('กำลังแก้ไขเส้นทาง...', 'info', manageRouteStatus);

    // Scroll to top of the form
    manageRoutesContainer.scrollIntoView({ behavior: 'smooth' });
}

async function deleteRoute(routeId) {
    // if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบเส้นทาง ID: ${routeId} นี้? การดำเนินการนี้จะลบเส้นทางและ segments ทั้งหมดที่เกี่ยวข้อง`)) {
    //     return;
    // }
    try {
        // Delete the route document
        await deleteDoc(doc(db, 'routes', routeId));

        // Delete associated segments
        const segmentsCollection = collection(db, 'route_segments');
        const segmentsToDeleteSnapshot = await getDocs(segmentsCollection);
        const batch = db.batch();

        segmentsToDeleteSnapshot.docs.forEach(segmentDoc => {
            if (segmentDoc.data().routeId === routeId) {
                batch.delete(segmentDoc.ref);
            }
        });
        await batch.commit();


        showStatusMessage(`ลบเส้นทาง ID: ${routeId} และ segments ที่เกี่ยวข้องสำเร็จ!`, 'success', manageRouteStatus);
        clearRouteForm();
        await loadAllRoutesForList();
        await loadStopsIntoDropdowns(); // Refresh search dropdowns
    } catch (error) {
        console.error("ข้อผิดพลาดในการลบเส้นทาง:", error);
        showStatusMessage(`เกิดข้อผิดพลาดในการลบเส้นทาง: ${error.message}`, 'error', manageRouteStatus);
    }
    location.reload();
}

function clearRouteForm() {
    editingRouteId = null;
    routeNameInput.value = '';
    routeColorInput.value = '#007bff'; // Reset to default color
    routeDescriptionInput.value = '';
    routeStopsContainer.innerHTML = ''; // Clear dynamic stops
    addRouteStopInput(); // Add one default stop input
    saveRouteButton.textContent = 'บันทึกเส้นทาง';
    cancelEditRouteButton.style.display = 'none';
    if (manageRouteStatus) manageRouteStatus.textContent = '';
}

saveRouteButton.addEventListener('click', saveRoute);
cancelEditRouteButton.addEventListener('click', clearRouteForm)




