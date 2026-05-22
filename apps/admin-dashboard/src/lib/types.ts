export type AppRole = 'super_admin' | 'company_admin' | 'employee';
export type AttendanceCheckType = 'check_in' | 'check_out';

export type UserProfile = {
  id: string;
  company_id: string;
  employee_id: string | null;
  role: AppRole;
  email: string;
  is_active: boolean;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
};

export type Employee = {
  id: string;
  company_id: string;
  employee_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  assigned_site_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type Site = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  is_active: boolean;
  created_at: string;
};

export type AttendanceSettings = {
  id: string;
  company_id: string;
  require_geofence: boolean;
  minimum_gps_accuracy: number;
  allow_check_in_outside_geofence: boolean;
  allow_multiple_checkins_per_day: boolean;
  require_notes: boolean;
  created_at: string;
};

export type AttendanceRecordDetailed = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string | null;
  site_id: string;
  site_name: string;
  check_type: AttendanceCheckType;
  attendance_time: string;
  latitude: number;
  longitude: number;
  gps_accuracy: number;
  distance_from_site: number;
  device_id: string;
  device_name: string | null;
  notes: string | null;
  created_at: string;
};

export type SelectOption = {
  label: string;
  value: string;
};
