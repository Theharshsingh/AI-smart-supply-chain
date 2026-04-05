require('dotenv').config();
const axios = require('axios');

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Major Indian railway stations with coords
const STATIONS = [
  { name: 'Mumbai CST',        code: 'CSTM', lat: 18.9402, lng: 72.8356, city: 'Mumbai' },
  { name: 'Mumbai Bandra',     code: 'BDTS', lat: 19.0544, lng: 72.8402, city: 'Mumbai' },
  { name: 'Delhi New Delhi',   code: 'NDLS', lat: 28.6419, lng: 77.2194, city: 'Delhi' },
  { name: 'Delhi Hazrat Nizamuddin', code: 'NZM', lat: 28.5894, lng: 77.2519, city: 'Delhi' },
  { name: 'Bangalore City',    code: 'SBC',  lat: 12.9775, lng: 77.5713, city: 'Bangalore' },
  { name: 'Chennai Central',   code: 'MAS',  lat: 13.0827, lng: 80.2750, city: 'Chennai' },
  { name: 'Kolkata Howrah',    code: 'HWH',  lat: 22.5839, lng: 88.3424, city: 'Kolkata' },
  { name: 'Hyderabad Secunderabad', code: 'SC', lat: 17.4344, lng: 78.5013, city: 'Hyderabad' },
  { name: 'Pune Junction',     code: 'PUNE', lat: 18.5284, lng: 73.8742, city: 'Pune' },
  { name: 'Ahmedabad Junction',code: 'ADI',  lat: 23.0258, lng: 72.6019, city: 'Ahmedabad' },
  { name: 'Dhanbad Junction',  code: 'DHN',  lat: 23.7957, lng: 86.4304, city: 'Dhanbad' },
  { name: 'Haridwar Junction', code: 'HW',   lat: 29.9457, lng: 78.1642, city: 'Haridwar' },
  { name: 'Jaipur Junction',   code: 'JP',   lat: 26.9124, lng: 75.7873, city: 'Jaipur' },
  { name: 'Lucknow Charbagh',  code: 'LKO',  lat: 26.8467, lng: 80.9462, city: 'Lucknow' },
  { name: 'Patna Junction',    code: 'PNBE', lat: 25.5941, lng: 85.1376, city: 'Patna' },
  { name: 'Bhopal Junction',   code: 'BPL',  lat: 23.2599, lng: 77.4126, city: 'Bhopal' },
  { name: 'Nagpur Junction',   code: 'NGP',  lat: 21.1458, lng: 79.0882, city: 'Nagpur' },
  { name: 'Surat Station',     code: 'ST',   lat: 21.2049, lng: 72.8418, city: 'Surat' },
  { name: 'Varanasi Junction', code: 'BSB',  lat: 25.3176, lng: 82.9739, city: 'Varanasi' },
  { name: 'Agra Cantt',        code: 'AGC',  lat: 27.1591, lng: 77.9858, city: 'Agra' },
];

function haversineKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Find N nearest stations to a coordinate
function findNearestStations(lat, lng, n = 3) {
  return STATIONS
    .map(s => ({ ...s, distKm: haversineKm({ lat, lng }, s) }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, n);
}

// Simulate train schedule between two stations
// In production: integrate RailwayAPI / IRCTC API
function getTrainSchedule(fromStation, toStation, distKm) {
  const now = new Date();
  const hour = now.getHours();

  // Simulate next available train (every 2-4 hours)
  const nextDepartures = [1, 2, 3, 4].map(h => {
    const dep = new Date(now.getTime() + h * 60 * 60 * 1000);
    const trainSpeedKmh = 80; // avg Indian express train
    const journeyH = distKm / trainSpeedKmh;
    const arr = new Date(dep.getTime() + journeyH * 60 * 60 * 1000);
    return {
      trainNo: `${12000 + Math.floor(Math.random() * 8000)}`,
      trainName: getTrainName(fromStation.city, toStation.city),
      departure: dep.toTimeString().slice(0, 5),
      arrival: arr.toTimeString().slice(0, 5),
      departureTs: dep.getTime(),
      journeyH: parseFloat(journeyH.toFixed(1)),
      distKm: Math.round(distKm),
      available: true,
    };
  });

  return nextDepartures;
}

function getTrainName(fromCity, toCity) {
  const names = ['Rajdhani Express', 'Shatabdi Express', 'Duronto Express', 'Garib Rath', 'Jan Shatabdi'];
  return names[Math.floor(Math.random() * names.length)];
}

// Road travel time estimate (minutes)
async function getRoadTimeMin(oLat, oLng, dLat, dLng) {
  if (!GMAPS_KEY || GMAPS_KEY.startsWith('your_')) {
    const dist = haversineKm({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
    return Math.round((dist / 40) * 60); // 40 km/h city speed
  }
  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: `${oLat},${oLng}`,
        destinations: `${dLat},${dLng}`,
        departure_time: 'now',
        key: GMAPS_KEY,
      },
      timeout: 6000,
    });
    const el = res.data.rows?.[0]?.elements?.[0];
    if (el?.status === 'OK') return Math.round(el.duration_in_traffic?.value / 60 || el.duration.value / 60);
  } catch (e) {}
  const dist = haversineKm({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
  return Math.round((dist / 40) * 60);
}

// Build complete train route plan: origin → nearest station → train → dest station → destination
async function buildTrainRoute(originCoords, destCoords, originName, destName) {
  const nearOriginStations = findNearestStations(originCoords.lat, originCoords.lng, 2);
  const nearDestStations   = findNearestStations(destCoords.lat,   destCoords.lng,   2);

  const results = [];

  for (const oStation of nearOriginStations) {
    for (const dStation of nearDestStations) {
      if (oStation.code === dStation.code) continue;

      const trainDistKm = haversineKm(oStation, dStation);
      if (trainDistKm < 50) continue; // too close for train

      // Road time to origin station
      const roadToStationMin = await getRoadTimeMin(
        originCoords.lat, originCoords.lng, oStation.lat, oStation.lng
      );

      // Road time from dest station to destination
      const roadFromStationMin = await getRoadTimeMin(
        dStation.lat, dStation.lng, destCoords.lat, destCoords.lng
      );

      const schedules = getTrainSchedule(oStation, dStation, trainDistKm);

      // Find first train user can catch (with 20 min buffer)
      const bufferMin = 20;
      const catchableTrains = schedules.filter(t =>
        t.departureTs > Date.now() + (roadToStationMin + bufferMin) * 60 * 1000
      );

      if (catchableTrains.length === 0) continue;

      const bestTrain = catchableTrains[0];
      const totalMin = roadToStationMin + bestTrain.journeyH * 60 + roadFromStationMin;

      results.push({
        originStation: oStation,
        destStation: dStation,
        roadToStationMin,
        roadFromStationMin,
        train: bestTrain,
        totalMin: Math.round(totalMin),
        totalH: parseFloat((totalMin / 60).toFixed(1)),
        trainDistKm: Math.round(trainDistKm),
        steps: [
          {
            step: 1,
            mode: 'ROAD',
            from: originName,
            to: oStation.name,
            distKm: Math.round(haversineKm(originCoords, oStation)),
            durationMin: roadToStationMin,
            instruction: `Drive to ${oStation.name} (${roadToStationMin} min)`,
          },
          {
            step: 2,
            mode: 'TRAIN',
            from: oStation.name,
            to: dStation.name,
            distKm: Math.round(trainDistKm),
            durationMin: Math.round(bestTrain.journeyH * 60),
            trainNo: bestTrain.trainNo,
            trainName: bestTrain.trainName,
            departure: bestTrain.departure,
            arrival: bestTrain.arrival,
            instruction: `Board ${bestTrain.trainName} (${bestTrain.trainNo}) at ${bestTrain.departure}, arrive ${bestTrain.arrival}`,
          },
          {
            step: 3,
            mode: 'ROAD',
            from: dStation.name,
            to: destName,
            distKm: Math.round(haversineKm(dStation, destCoords)),
            durationMin: roadFromStationMin,
            instruction: `Drive to ${destName} (${roadFromStationMin} min)`,
          },
        ],
      });
    }
  }

  // Sort by total time
  results.sort((a, b) => a.totalMin - b.totalMin);
  return results.slice(0, 2); // return top 2 options
}

module.exports = { buildTrainRoute, findNearestStations, STATIONS };
