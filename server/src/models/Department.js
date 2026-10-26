import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [50, 'Department code cannot exceed 50 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

departmentSchema.index({ isActive: 1, name: 1 });

/**
 * Standard default campus departments for automatic initial seeding
 */
export const DEFAULT_DEPARTMENTS = [
  {
    name: 'Maintenance and Facilities',
    code: 'facilities',
    description: 'Campus civil infrastructure, building repairs, physical plant maintenance, and structural upkeep.',
  },
  {
    name: 'Electrical',
    code: 'electrical',
    description: 'Power distribution, lighting, generators, transformer yards, and electrical grid safety.',
  },
  {
    name: 'Plumbing and Water',
    code: 'plumbing',
    description: 'Drinking water lines, restrooms, washrooms, sewage pipes, pumps, and water purification units.',
  },
  {
    name: 'Housekeeping and Sanitation',
    code: 'sanitation',
    description: 'Corridor cleanliness, trash disposal, classroom hygiene, pest control, and campus sanitation.',
  },
  {
    name: 'IT Support',
    code: 'it_support',
    description: 'Campus Wi-Fi connectivity, computer labs, server infrastructure, projectors, and IT hardware.',
  },
  {
    name: 'Security',
    code: 'security',
    description: 'Gate control, surveillance cameras, campus safety guards, emergency response, and night patrols.',
  },
  {
    name: 'Transport and Parking',
    code: 'transport',
    description: 'Campus shuttle buses, designated vehicle parking zones, traffic regulation, and road maintenance.',
  },
  {
    name: 'Hostel Administration',
    code: 'hostels',
    description: 'Residential hostels, dorm rooms, warden oversight, mess facilities, and student accommodations.',
  },
  {
    name: 'Academic Administration',
    code: 'academics',
    description: 'Lecture halls, faculty offices, examination centers, seminar rooms, and departmental auditoriums.',
  },
  {
    name: 'Canteen and Food Services',
    code: 'canteen',
    description: 'Campus cafeterias, food stalls, dining halls, culinary hygiene, and kitchen equipment.',
  },
  {
    name: 'Other',
    code: 'other',
    description: 'General campus affairs and miscellaneous facilities not categorized above.',
  },
];

/**
 * Ensure default departments exist in the database without overwriting existing data
 */
export async function ensureDefaultDepartments() {
  try {
    const count = await Department.countDocuments();
    if (count === 0) {
      await Department.insertMany(DEFAULT_DEPARTMENTS);
      console.log('✅ Initial campus departments seeded successfully.');
    }
  } catch (error) {
    console.warn('⚠️ Department default seeding check skipped:', error.message);
  }
}

const Department = mongoose.model('Department', departmentSchema);

export default Department;
