const mongoose = require('mongoose');

const inventoryRecordSchema = new mongoose.Schema({
  nodeType: {
    type: String,
    required: true
  },
  SerialNumber: {
    type: String,
    required: true
  },
  Circle: {
    type: String,
    required: true
  },
  SiteID: {
    type: String,
    required: true
  },
  NodeID: {
    type: String,
    required: true
  },
  NodeName: {
    type: String,
    required: true
  },
  EquipmentModel: {
    type: String,
    required: true
  },
  OEM: {
    type: String,
    required: true
  },
  MainCabinet: {
    type: String,
    required: true
  },
  HardwareType: {
    type: String,
    required: true
  },
  BoardPartNumber: {
    type: String,
    required: true
  },
  BoardSerialNumber: {
    type: String,
    required: true
  },
  Technology: {
    type: String,
    required: true
  },
  flag: {
    type: String,
    required: true
  },
  Not_Visible_Days: {
    type: Number,
    default: 0
  },
  DiscoveryDate: {
    type: String, // if this is always a "YYYY_MM_DD" string
    required: true
  },
  UpdateDate: {
    type: String,
    required: true
  },
  inventory_DiscoveryDate: {
    type: Date,
    required: true
  },
  inventory_UpdateDate: {
    type: Date,
    required: true
  }
});

// Virtual ID
inventoryRecordSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Remove _id and __v from JSON output
inventoryRecordSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    delete ret._id;
    delete ret.__v;
  }
});

exports.InventoryRecord = mongoose.model('ideploy_base_ran', inventoryRecordSchema);
exports.inventoryRecordSchema = inventoryRecordSchema;
