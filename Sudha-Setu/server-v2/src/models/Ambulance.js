import mongoose from 'mongoose';

const ambulanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      trim: true,
      unique: true,
    },
    stationName: {
      type: String,
      required: [true, 'Station name is required'],
      trim: true,
    },
    serviceProvider: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Ambulance = mongoose.model('Ambulance', ambulanceSchema);

export default Ambulance;
