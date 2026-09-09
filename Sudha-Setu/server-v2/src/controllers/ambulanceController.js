import Ambulance from '../models/Ambulance.js';

export const getMyAmbulanceProfile = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findOne({ userId: req.user._id }).populate(
      'userId',
      'name email phone'
    );
    if (!ambulance) {
      return res.status(404).json({ message: 'No ambulance profile found for this account' });
    }
    res.json({ ambulance });
  } catch (err) {
    next(err);
  }
};
