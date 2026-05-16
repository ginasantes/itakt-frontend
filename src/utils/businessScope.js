export function inferBusinessScopeFromProfile({ businessType = '', roleName = '', email = '', fullName = '' } = {}) {
  const normalizedBusinessType = String(businessType || '').toLowerCase();
  if (normalizedBusinessType === 'restaurante' || normalizedBusinessType === 'catering') {
    return normalizedBusinessType;
  }

  const normalizedRole = String(roleName || '').toLowerCase();
  if (normalizedRole.includes('catering')) {
    return 'catering';
  }

  if (normalizedRole.includes('restaurante')) {
    return 'restaurante';
  }

  const normalizedName = String(fullName || '').toLowerCase();
  if (normalizedName.includes('catering') || normalizedName.includes('banquete') || normalizedName.includes('evento')) {
    return 'catering';
  }

  if (normalizedName.includes('restaurante') || normalizedName.includes('mesero local')) {
    return 'restaurante';
  }

  const normalizedEmail = String(email || '').toLowerCase();
  if (normalizedEmail.includes('catering') || normalizedEmail.includes('evento') || normalizedEmail.includes('banquete') || normalizedEmail.includes('campo')) {
    return 'catering';
  }

  return 'restaurante';
}
