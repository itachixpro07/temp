import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    emergencyCapable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Hospital = mongoose.model('Hospital', hospitalSchema);

export default Hospital;
