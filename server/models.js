const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  name:      String,
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  role:      { type: String, default: 'driver' },
  phone:     { type: String, default: '' },
  active:    { type: Boolean, default: true },
}, { timestamps: true });

const timelineSchema = new mongoose.Schema({
  status: String, label: String, time: String, note: String,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true },
  awb:          { type: String, unique: true },
  otp:          String,
  status:       { type: String, default: 'pending' },
  createdBy:    String,
  customerId:   String,
  senderName:   String, senderPhone: String, senderAddress: String,
  fromLat:      Number, fromLon: Number,
  receiverName: String, receiverPhone: String, receiverAddress: String,
  toLat:        Number, toLon: Number,
  packageDesc:  String, weightKg: Number, packageType: String, notes: String,
  distanceKm:   Number, durationMin: Number,
  driverId:     String, driverName: String, driverPhone: String, driverVehicle: String,
  timeline:     [timelineSchema],
  currentLat:   Number, currentLng: Number, locationUpdatedAt: String,
  deliveredAt:  String, otpVerified: { type: Boolean, default: false },
  rating:       { type: Number, default: null },
  feedback:     { type: String, default: '' },
}, { timestamps: true });

const driverShipmentSchema = new mongoose.Schema({
  id:                { type: String, required: true, unique: true },
  driverId:          String,
  driverName:        String,
  serverCreatedAt:   String,
  currentLat:        Number,
  currentLng:        Number,
  locationUpdatedAt: String,
}, { strict: false, timestamps: true });

const User           = mongoose.model('User',           userSchema);
const Order          = mongoose.model('Order',          orderSchema);
const DriverShipment = mongoose.model('DriverShipment', driverShipmentSchema);

module.exports = { User, Order, DriverShipment };
