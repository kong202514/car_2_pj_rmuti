 import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js"

import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js"



const firebaseConfig = {

    apiKey: "AIzaSyBXn8SyiVLWui1I7RbwiHAkARvjN3-TGU0",

    authDomain: "qazx-3fc6e.firebaseapp.com",

    projectId: "qazx-3fc6e",

    storageBucket: "qazx-3fc6e.firebasestorage.app",

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



    const directRoutes = allRoutes.filter(route => {

        const stopIds = route.stops.map(s => s.stopId)

        return stopIds.includes(origin) && stopIds.includes(destination)

    })



    if (directRoutes.length > 0) {

        resultsContainer.innerHTML += '<h3>เส้นทางตรง:</h3>'
        directRoutes.forEach(route => {
            const sortedStops = [...route.stops].sort((a, b) => a.order - b.order)
            const stopList = sortedStops.map((s, i) => {
                const stopData = allStops.find(stop => stop.id === s.stopId)
                return `<li>${i + 1}. ${stopData ? stopData.name : s.stopId}</li>`
            }).join('')
            resultsContainer.innerHTML += `
        <div>

          <div><b>สาย: ${route.name}</b> - ${route.description || 'ไม่มีคำอธิบาย'}</div>

          <ol>${stopList}</ol>

        </div>`

        })

    } else {

        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางตรง</p>'

    }



    const transfers = []

    for (const route1 of allRoutes) {

        if (!route1.stops.some(s => s.stopId === origin)) continue



        for (const route2 of allRoutes) {

            if (route1.id === route2.id || !route2.stops.some(s => s.stopId === destination)) continue



            const transferStopId = route1.stops

                .map(s => s.stopId)

                .find(id => route2.stops.some(s2 => s2.stopId === id) && id !== origin && id !== destination)



            if (transferStopId) {

                const transferStop = allStops.find(s => s.id === transferStopId)

                transfers.push({

                    transferAt: transferStop?.name || transferStopId,

                    route1,

                    route2,

                    transferStopId

                })

            }

        }

    }



    if (transfers.length > 0) {

        resultsContainer.innerHTML += '<h3>เส้นทางต่อรถ (1 จุด):</h3>'

        transfers.forEach((t, i) => {

            const stops1 = [...t.route1.stops].sort((a, b) => a.order - b.order)

            const stops2 = [...t.route2.stops].sort((a, b) => a.order - b.order)



            const stopList1 = stops1.map((s, idx) => {

                const stopData = allStops.find(stop => stop.id === s.stopId)

                const mark = s.stopId === origin ? '✅ ' : (s.stopId === t.transferStopId ? '➡️ ' : '')

                return `<li>${mark} ${stopData ? stopData.name : s.stopId}</li>`

            }).join('')



            const stopList2 = stops2.map((s, idx) => {

                const stopData = allStops.find(stop => stop.id === s.stopId)

                const mark = s.stopId === t.transferStopId ? '➡️ ' : (s.stopId === destination ? '🏁 ' : '')

                return `<li>${mark} ${stopData ? stopData.name : s.stopId}</li>`

            }).join('')

            // <div>สามารถต่อรถได้ที่ => <strong>${t.transferAt}</strong></div>



            resultsContainer.innerHTML += `

        <div>

          <div><b>แผนการเดินทางที่ ${i + 1}</b>: ขึ้นรถสาย ${t.route1.name}</div>

          มาลงที่ ${t.transferAt}

          <div>แล้วขึ้นสายที่ ${t.route2.name} ที่ ${t.transferAt}</div>

          <div>โดยสายแรกมีจุดจอดรถดังนี้:</div>

          <ol>${stopList1}</ol>

          <div>และ สายที่ สอง มีจุดจอดรถดังนี้:</div>

          <ol>${stopList2}</ol>

        </div>`

        })

    } else {

        resultsContainer.innerHTML += '<p>ไม่พบเส้นทางต่อรถ</p>'

    }



    loadingMessage.style.display = 'none'

}



searchButton.addEventListener('click', findRoute)



document.addEventListener('DOMContentLoaded', async () => {

    await loadAllStopsData()

    await loadAllRoutesData()

    await loadAllRouteSegmentsData()

    populateDropdown(originSelect, allStops)

    populateDropdown(destinationSelect, allStops)

})
