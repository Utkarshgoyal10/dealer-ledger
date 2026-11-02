import mongoose from 'mongoose';

export const DEFAULT_ROUTES = ['Siyana', 'Aurangabad', 'BB Nagar', 'Garh', 'Simbhawli', 'Khanpur', 'Bugrasi', 'Jahangirabad'];

const routeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Lower-cased copy so "garh" and "Garh" are treated as the same route
    key: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const routeKey = (name) => String(name).trim().replace(/\s+/g, ' ').toLowerCase();

export const Route = mongoose.model('Route', routeSchema);

/** Adds the default routes the first time the app runs */
export async function seedRoutes() {
  if ((await Route.estimatedDocumentCount()) > 0) return;
  await Route.insertMany(DEFAULT_ROUTES.map((name) => ({ name, key: routeKey(name) })));
  console.log('Default routes added');
}
