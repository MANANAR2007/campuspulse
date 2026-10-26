import mongoose from 'mongoose';
import Department from '../models/Department.js';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import { logAuditEvent } from '../models/AuditEvent.js';

/**
 * GET /api/departments
 * Retrieve list of campus departments.
 * Regular users and staff see active departments.
 * Admins can pass ?includeInactive=true to see all.
 */
export const getDepartments = async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const includeInactive = isAdmin && req.query.includeInactive === 'true';

    const filter = includeInactive ? {} : { isActive: true };

    const departments = await Department.find(filter).sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        departments,
        count: departments.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/departments
 * Admin creates a new department
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        status: 'fail',
        message: 'Department name is required (minimum 2 characters).',
      });
    }

    const trimmedName = name.trim();
    const derivedCode = (code && typeof code === 'string' && code.trim().length > 0)
      ? code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      : trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);

    const existing = await Department.findOne({
      $or: [{ name: trimmedName }, { code: derivedCode }],
    });

    if (existing) {
      return res.status(409).json({
        status: 'fail',
        message: 'A department with this name or code already exists.',
      });
    }

    const department = await Department.create({
      name: trimmedName,
      code: derivedCode,
      description: description && typeof description === 'string' ? description.trim() : '',
      isActive: true,
    });

    await logAuditEvent({
      entityType: 'department',
      entityId: department._id,
      action: 'department_created',
      actor: req.user._id,
      details: { name: department.name, code: department.code },
      reason: 'Created by administrator',
    });

    res.status(201).json({
      status: 'success',
      message: 'Department created successfully.',
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/departments/:id
 * Admin updates department details or toggles active status
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid department ID format.',
      });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        status: 'fail',
        message: 'Department not found.',
      });
    }

    const previousState = {
      name: department.name,
      description: department.description,
      isActive: department.isActive,
    };

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      department.name = name.trim();
    }

    if (description !== undefined && typeof description === 'string') {
      department.description = description.trim();
    }

    if (isActive !== undefined) {
      department.isActive = Boolean(isActive);
    }

    await department.save();

    await logAuditEvent({
      entityType: 'department',
      entityId: department._id,
      action: 'department_updated',
      actor: req.user._id,
      details: { previous: previousState, current: department },
      reason: 'Updated by administrator',
    });

    res.status(200).json({
      status: 'success',
      message: 'Department updated successfully.',
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/departments/:id/staff
 * Retrieve all active staff members for a specific department,
 * including their current active issue workload counts.
 */
export const getDepartmentStaff = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid department ID format.',
      });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        status: 'fail',
        message: 'Department not found.',
      });
    }

    // Find active staff belonging to this department
    const staffMembers = await User.find({
      role: 'staff',
      department: id,
      isActive: true,
    })
      .select('_id name email department departmentName isActive')
      .sort({ name: 1 });

    const staffIds = staffMembers.map((s) => s._id);

    // Compute active workloads
    const workloads = await Issue.aggregate([
      {
        $match: {
          assignedTo: { $in: staffIds },
          status: { $nin: ['resolved', 'rejected'] },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          activeCount: { $sum: 1 },
        },
      },
    ]);

    const workloadMap = new Map(
      workloads.map((w) => [w._id.toString(), w.activeCount])
    );

    const staffWithWorkload = staffMembers.map((staff) => {
      const staffObj = staff.toJSON ? staff.toJSON() : { ...staff };
      staffObj.activeIssuesCount = workloadMap.get(staff._id.toString()) || 0;
      return staffObj;
    });

    res.status(200).json({
      status: 'success',
      data: {
        department: {
          id: department._id.toString(),
          name: department.name,
          code: department.code,
          isActive: department.isActive,
        },
        staff: staffWithWorkload,
      },
    });
  } catch (error) {
    next(error);
  }
};
