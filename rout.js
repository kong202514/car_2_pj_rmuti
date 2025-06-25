import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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

// References to HTML elements
const originSelect = document.getElementById('originSelect');
const destinationSelect = document.getElementById('destinationSelect');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('results-container');
const loadingMessage = document.getElementById('loading-message');

// เก็บข้อมูลจุดจอดทั้งหมดในหน่วยความจำ
let allStops = [];

// ฟังก์ชันสำหรับโหลดจุดจอดทั้งหมดและเติมลงใน Dropdown List
async function loadStopsIntoDropdowns() {
    try {
        const stopsCollectionRef = collection(db, 'stops');
        const querySnapshot = await getDocs(stopsCollectionRef);
        allStops = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // เติมข้อมูลลงใน Dropdown Lists
        populateDropdown(originSelect, allStops);
        populateDropdown(destinationSelect, allStops);

        console.log("โหลดข้อมูลจุดจอดทั้งหมดและเติมลงใน Dropdown Lists แล้ว");
    } catch (error) {
        console.error("ข้อผิดพลาดในการโหลดจุดจอดและเติม Dropdown Lists:", error);
        resultsContainer.innerHTML = '<p class="no-results">ไม่สามารถโหลดข้อมูลจุดจอดได้ โปรดลองอีกครั้ง</p>';
    }
}

// ฟังก์ชันช่วยในการเติม Dropdown
function populateDropdown(selectElement, stopsData) {
    // ล้าง options เก่า ยกเว้น option แรก "เลือก..."
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild);
    }

    // เพิ่ม options ใหม่
    stopsData.forEach(stop => {
        const option = document.createElement('option');
        option.value = stop.id; // ใช้ stop.id เป็น value
        option.textContent = stop.name; // ใช้ stop.name เป็นข้อความที่แสดง
        selectElement.appendChild(option);
    });
}

// ฟังก์ชันหลักสำหรับค้นหาเส้นทาง
async function findRoute() {
    resultsContainer.innerHTML = ''; // ล้างผลลัพธ์เก่า
    loadingMessage.style.display = 'block'; // แสดงข้อความกำลังโหลด

    const originStopId = originSelect.value;
    const destinationStopId = destinationSelect.value;

    if (!originStopId || !destinationStopId) {
        loadingMessage.style.display = 'none';
        resultsContainer.innerHTML = '<p class="no-results">กรุณาเลือกจุดต้นทางและจุดปลายทาง</p>';
        return;
    }

    // ตรวจสอบว่าเลือกจุดต้นทางและปลายทางเป็นจุดเดียวกันหรือไม่
    if (originStopId === destinationStopId) {
        loadingMessage.style.display = 'none';
        resultsContainer.innerHTML = '<p class="no-results">จุดต้นทางและจุดปลายทางไม่สามารถเป็นจุดเดียวกันได้</p>';
        return;
    }

    console.log("ค้นหาเส้นทางจาก:", originStopId, "ไป:", destinationStopId);

    try {
        const routesCollectionRef = collection(db, 'routes');
        const querySnapshot = await getDocs(routesCollectionRef);
        const allRoutes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const foundRoutes = [];

        for (const route of allRoutes) {
            const stopsInRoute = route.stops; // Array ของ { stopId, order }

            // หา index ของจุดต้นทางและปลายทางใน array stops ของเส้นทางนี้
            const originIndex = stopsInRoute.findIndex(s => s.stopId === originStopId);
            const destinationIndex = stopsInRoute.findIndex(s => s.stopId === destinationStopId);

            // ตรวจสอบว่าทั้งสองจุดอยู่ในเส้นทาง และจุดต้นทางมาก่อนจุดปลายทาง
            if (originIndex !== -1 && destinationIndex !== -1 && originIndex < destinationIndex) {
                foundRoutes.push(route);
            }
        }

        displayFoundRoutes(foundRoutes, allStops); // ส่ง allStops ไปด้วยเพื่อใช้ในการแสดงชื่อจุดจอด
    } catch (error) {
        console.error("ข้อผิดพลาดในการค้นหาเส้นทาง:", error);
        resultsContainer.innerHTML = `<p class="no-results">เกิดข้อผิดพลาดในการค้นหาเส้นทาง: ${error.message}</p>`;
    } finally {
        loadingMessage.style.display = 'none'; // ซ่อนข้อความกำลังโหลด
    }
}

// ฟังก์ชันสำหรับแสดงผลลัพธ์เส้นทางที่พบ (เหมือนเดิม)
async function displayFoundRoutes(routes, allStopsData) {
    if (routes.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">ไม่พบเส้นทางตรงที่เชื่อมต่อจุดต้นทางและจุดปลายทาง</p>';
        return;
    }

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

        const stopListTitle = document.createElement('h4');
        stopListTitle.textContent = 'จุดจอดในเส้นทางนี้:';
        routeCard.appendChild(stopListTitle);

        const stopList = document.createElement('ol'); // ใช้ <ol> สำหรับลำดับ
        stopList.classList.add('stop-list');

        // เรียงลำดับจุดจอดตาม 'order' ก่อนแสดง
        const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);

        for (const stopRef of sortedStops) {
            const stopId = stopRef.stopId;
            const stopData = allStopsData.find(s => s.id === stopId); // หาข้อมูลจุดจอดจาก allStops

            const stopItem = document.createElement('li');
            if (stopData) {
                stopItem.textContent = stopData.name;
            } else {
                stopItem.textContent = `ไม่พบข้อมูลจุดจอด (ID: ${stopId})`;
                stopItem.style.color = 'red'; // เน้นว่าไม่พบข้อมูล
            }
            stopList.appendChild(stopItem);
        }
        routeCard.appendChild(stopList);
        resultsContainer.appendChild(routeCard);
    }
}

// Event Listener สำหรับปุ่มค้นหา
searchButton.addEventListener('click', findRoute);

// โหลดข้อมูลจุดจอดทั้งหมดและเติมลงใน Dropdown Lists เมื่อหน้าเว็บโหลดเสร็จสมบูรณ์
document.addEventListener('DOMContentLoaded', loadStopsIntoDropdowns);