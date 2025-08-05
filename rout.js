// จากโค้ดชุดนี้จงแก้ไขให้มีลักษณะดังนี้ 1  หากค้นพบว่าเป็นจุดต่อรถให้แสดงเส้นทางรถอีกเส้นหนึ่งเป็นแนวนอน
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js"
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js"

const firebaseConfig = {
    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",
    authDomain: "qazx-3fc6e.firebaseapp.com",
    projectId: "qazx-3fc6e",
    storageBucket: "qazx-3fc6e.appspot.com",
    messagingSenderId: "101969041040",
    appId: "1:101969041040:web:a578a1b724e1ebf7f9aa15",
    measurementId: "G-8RFTQKJH2Y"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const originSelect = document.getElementById('originSelect')
const destinationSelect = document.getElementById('destinationSelect')
const searchButton = document.getElementById('searchButton')
const resultsContainer = document.getElementById('results-container')
const loadingMessage = document.getElementById('loading-message')

let allStops = []
let allRoutes = []
let allRouteSegments = []

function populateDropdown(selectElement, stopsData) {
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild)
    }
    stopsData.sort((a, b) => a.name.localeCompare(b.name, 'th'))
    stopsData.forEach(stop => {
        const option = document.createElement('option')
        option.value = stop.id
        option.textContent = stop.name
        selectElement.appendChild(option)
    })
}

async function loadAllStopsData() {
    const snapshot = await getDocs(collection(db, 'stops'))
    allStops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function loadAllRoutesData() {
    const snapshot = await getDocs(collection(db, 'routes'))
    allRoutes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function loadAllRouteSegmentsData() {
    const snapshot = await getDocs(collection(db, 'route_segments'))
    allRouteSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// ปรับปรุงฟังก์ชันแสดงผล SVG
function renderSVGPath(nodes, container, color = '#4a90e2') {
    container.innerHTML = ''

    const width = 300
    const spaceY = 70
    const height = spaceY * nodes.length + 40

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", width)
    svg.setAttribute("height", height)

    // Define arrow marker
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker")
    marker.setAttribute("id", "arrow")
    marker.setAttribute("markerWidth", "8")
    marker.setAttribute("markerHeight", "8")
    marker.setAttribute("refX", "6")
    marker.setAttribute("refY", "3")
    marker.setAttribute("orient", "auto")
    marker.setAttribute("markerUnits", "strokeWidth")

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", "M0,0 L6,3 L0,6 Z")
    path.setAttribute("fill", color)
    marker.appendChild(path)
    defs.appendChild(marker)
    svg.appendChild(defs)

    const centerX = width / 2
    const radius = 12

    nodes.forEach((node, i) => {
        const cy = 20 + i * spaceY

        // วาดวงกลมแต่ละจุด
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        circle.setAttribute("cx", centerX)
        circle.setAttribute("cy", cy)
        circle.setAttribute("r", radius)
        circle.setAttribute("fill", color)
        circle.setAttribute("stroke", "#333")
        circle.setAttribute("stroke-width", "2")
        svg.appendChild(circle)

        // แสดงชื่อจุดทางขวาของวงกลม
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", centerX + radius + 10)
        text.setAttribute("y", cy + 5)
        text.setAttribute("fill", "#222")
        text.style.fontSize = "16px"
        text.style.fontFamily = "Arial, sans-serif"
        text.textContent = node.label
        svg.appendChild(text)

        // วาดเส้นลูกศรเชื่อมแต่ละจุด
        if (i < nodes.length - 1) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
            line.setAttribute("x1", centerX)
            line.setAttribute("y1", cy + radius)
            line.setAttribute("x2", centerX)
            line.setAttribute("y2", cy + spaceY - radius)
            line.setAttribute("stroke", color)
            line.setAttribute("stroke-width", "3")
            line.setAttribute("marker-end", "url(#arrow)")
            svg.appendChild(line)
        }
    })

    container.appendChild(svg)
}

// ฟังก์ชันหาเส้นทางหลัก และต่อรถ 1 จุด + 2 จุด
async function findRoute() {
    resultsContainer.innerHTML = ''
    loadingMessage.style.display = 'block'

    const origin = originSelect.value
    const destination = destinationSelect.value

    if (!origin || !destination || origin === destination) {
        loadingMessage.style.display = 'none'
        resultsContainer.innerHTML = '<p style="color:red;">กรุณาเลือกจุดต้นทางและปลายทางที่ไม่ซ้ำกัน</p>'
        return
    }

    // หาเส้นทางตรง
    const directRoutes = allRoutes.filter(route => {
        const stopIds = route.stops.map(s => s.stopId)
        return stopIds.includes(origin) && stopIds.includes(destination)
    })

    if (directRoutes.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางตรง:</h3>'
        const limitedDirectRoutes = directRoutes.slice(0, 2)
        for (const route of limitedDirectRoutes) {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order)
            const stopList = sortedStops.map((s, i) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return `<li>${i + 1}. ${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

            resultsContainer.innerHTML += `
                <div>
                    <div><b>สาย: ${route.name}</b> - ${route.description || 'ไม่มีคำอธิบาย'}</div>
                    <ol>${stopList}</ol>
                    <div id="svg-route-${route.id}"></div>
                    <div><b>เส้นทางขากลับ:</b></div>
                    <div id="svg-route-reverse-${route.id}"></div>
                </div>`

            const nodes = sortedStops.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })
            renderSVGPath(nodes, document.getElementById(`svg-route-${route.id}`), '#2980b9')
            renderSVGPath([...nodes].reverse(), document.getElementById(`svg-route-reverse-${route.id}`), '#2980b9')
        }
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางตรง</p>'
    }

    // หาเส้นทางต่อรถ 1 จุด
    const transfers1 = []
    for (const route1 of allRoutes) {
        if (!route1.stops.some(s => s.stopId === origin)) continue
        for (const route2 of allRoutes) {
            if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destination)) continue
            const transferStopId = route1.stops
                .map(s => s.stopId)
                .find(id => route2.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination)

            if (transferStopId) {
                const transferStop = allStops.find(s => s.id === transferStopId)
                transfers1.push({
                    transferAt: transferStop?.name || transferStopId,
                    route1,
                    route2,
                    transferStopId
                })
            }
        }
    }

    if (transfers1.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (1 จุด):</h3>'
        const limitedTransfers = transfers1.slice(0, 2)
        limitedTransfers.forEach((t, i) => {
            const stops1 = [...t.route1.stops].sort((a, b) => a.order - b.order)
            const stops2 = [...t.route2.stops].sort((a, b) => a.order - b.order)

            const stopList1 = stops1.map((s) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === origin ? '✅ ' : (s.stopId === t.transferStopId ? '➡️ ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

            const stopList2 = stops2.map((s) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === t.transferStopId ? '➡️ ' : (s.stopId === destination ? '🏁 ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

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
                </div>`

            const nodes1 = stops1.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })
            const nodes2 = stops2.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })

            renderSVGPath(nodes1, document.getElementById(`svg-transfer1-${i}`), '#e67e22') // ส้ม
            renderSVGPath(nodes2, document.getElementById(`svg-transfer2-${i}`), '#2980b9') // น้ำเงิน
            renderSVGPath([...nodes2].reverse(), document.getElementById(`svg-transfer2-rev-${i}`), '#2980b9')
            renderSVGPath([...nodes1].reverse(), document.getElementById(`svg-transfer1-rev-${i}`), '#e67e22')
        })
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ 1 จุด</p>'
    }

    // หาเส้นทางต่อรถ 2 จุด
    const transfers2 = []

    for (const routeA of allRoutes) {
        if (!routeA.stops.some(s => s.stopId === origin)) continue

        for (const routeB of allRoutes) {
            if (routeB.id === routeA.id) continue

            for (const routeC of allRoutes) {
                if (routeC.id === routeA.id || routeC.id === routeB.id) continue
                if (!routeC.stops.some(s => s.stopId === destination)) continue

                // หาจุดต่อรถ 2 จุด
                const transferStop1 = routeA.stops
                    .map(s => s.stopId)
                    .find(id => routeB.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination)
                if (!transferStop1) continue

                const transferStop2 = routeB.stops
                    .map(s => s.stopId)
                    .find(id => routeC.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination && id !== transferStop1)
                if (!transferStop2) continue

                // ตรวจสอบลำดับจุดเดินทางให้ถูกต้อง (origin -> transfer1 -> transfer2 -> destination)
                const originOrder = routeA.stops.find(s => s.stopId === origin)?.order ?? -1
                const transfer1OrderInA = routeA.stops.find(s => s.stopId === transferStop1)?.order ?? -1
                if (transfer1OrderInA <= originOrder) continue

                const transfer1OrderInB = routeB.stops.find(s => s.stopId === transferStop1)?.order ?? -1
                const transfer2OrderInB = routeB.stops.find(s => s.stopId === transferStop2)?.order ?? -1
                if (transfer2OrderInB <= transfer1OrderInB) continue

                const transfer2OrderInC = routeC.stops.find(s => s.stopId === transferStop2)?.order ?? -1
                const destinationOrderInC = routeC.stops.find(s => s.stopId === destination)?.order ?? -1
                if (destinationOrderInC <= transfer2OrderInC) continue

                transfers2.push({
                    routeA,
                    routeB,
                    routeC,
                    transferStop1,
                    transferStop2,
                    transferAt1: allStops.find(s => s.id === transferStop1)?.name || transferStop1,
                    transferAt2: allStops.find(s => s.id === transferStop2)?.name || transferStop2
                })
            }
        }
    }

    if (transfers2.length > 0) {
        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (2 จุด):</h3>'
        const limitedTransfers2 = transfers2.slice(0, 1)
        limitedTransfers2.forEach((t, i) => {
            const stopsA = [...t.routeA.stops].sort((a, b) => a.order - b.order)
            const stopsB = [...t.routeB.stops].sort((a, b) => a.order - b.order)
            const stopsC = [...t.routeC.stops].sort((a, b) => a.order - b.order)

            // สร้าง list จุด พร้อมไฮไลท์จุด origin, transfer, destination
            const stopListA = stopsA.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === origin ? '✅ ' : (s.stopId === t.transferStop1 ? '➡️ ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

            const stopListB = stopsB.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === t.transferStop1 ? '➡️ ' : (s.stopId === t.transferStop2 ? '➡️ ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

            const stopListC = stopsC.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                const mark = s.stopId === t.transferStop2 ? '➡️ ' : (s.stopId === destination ? '🏁 ' : '')
                return `<li>${mark}${stopData ? stopData.name : s.stopId}</li>`
            }).join('')

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
            `

            const nodesA = stopsA.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })
            const nodesB = stopsB.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })
            const nodesC = stopsC.map(s => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return { label: stopData ? stopData.name : s.stopId, id: s.stopId }
            })

            renderSVGPath(nodesA, document.getElementById(`svg-transfer3-1-${i}`), '#d35400') // สีส้มเข้ม
            renderSVGPath(nodesB, document.getElementById(`svg-transfer3-2-${i}`), '#2980b9') // สีน้ำเงิน
            renderSVGPath(nodesC, document.getElementById(`svg-transfer3-3-${i}`), '#27ae60') // สีเขียว

            renderSVGPath([...nodesC].reverse(), document.getElementById(`svg-transfer3-3-rev-${i}`), '#27ae60')
            renderSVGPath([...nodesB].reverse(), document.getElementById(`svg-transfer3-2-rev-${i}`), '#2980b9')
            renderSVGPath([...nodesA].reverse(), document.getElementById(`svg-transfer3-1-rev-${i}`), '#d35400')
        })
    } else {
        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ 2 จุด</p>'
    }
 
    loadingMessage.style.display = 'none'
}

searchButton.addEventListener('click', findRoute)

async function init() {
    loadingMessage.style.display = 'block'
    await Promise.all([loadAllStopsData(), loadAllRoutesData(), loadAllRouteSegmentsData()])
    populateDropdown(originSelect, allStops)
    populateDropdown(destinationSelect, allStops)
    loadingMessage.style.display = 'none'
}

init()
