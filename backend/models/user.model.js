import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    wallet: {
      type: Number,
      default: Number(process.env.STARTING_BALANCE ?? 10),
      min: 0,
    },
    inventory: [
      {
        name: { type: String, required: true },
        value: { type: Number, required: true },
        image: { type: String, required: true },
        rarityClass: { type: String, required: true },
        wear: { type: String, required: true },
        exterior: { type: String, required: true },
        gunClass: { type: String, required: true },
        obtainedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password comparison method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;