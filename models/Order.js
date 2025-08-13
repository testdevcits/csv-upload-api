const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  pwnOrderId: { type: String, required: true },
  pwnOrderStatus: String,
  confirmationCode: String,
  pwnCreatedAt: Date,
  pwnExpiresAt: Date,
  address: String,
  visitType: String,
  testTypes: String,
  reasonForTesting: String,
  pwnLink: String,
  pwnPhysicianName: String,
  externalId: String,
  providerId: Number,
  firstName: String,
  lastName: String,
  dob: Date,
  state: String,
  accountNumber: String,
  homePhone: String,
  workPhone: String,
  mobilePhone: String,
  zip: String,
  email: String,
  gender: String,
});

module.exports = mongoose.model("Order", OrderSchema);
