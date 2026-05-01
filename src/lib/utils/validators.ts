interface ValidationResult {
  valid: boolean
  error?: string
}

/** Simple email validation for auth flow */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) {
    return { valid: false, error: 'Email is required.' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Enter a valid email address.' }
  }
  return { valid: true }
}

export function validatePhone(phone: string): { valid: boolean; formatted: string; error?: string } {
  const digits = phone.replace(/\D/g, '')

  if (digits.length < 10) {
    return { valid: false, formatted: phone, error: 'Phone number must be at least 10 digits.' }
  }

  let formatted: string
  if (digits.startsWith('1') && digits.length === 11) {
    formatted = `+${digits}`
  } else if (digits.length === 10) {
    formatted = `+1${digits}`
  } else if (phone.startsWith('+')) {
    formatted = `+${digits}`
  } else {
    formatted = `+${digits}`
  }

  return { valid: true, formatted }
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Password is required.' }
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters.' }
  }
  return { valid: true }
}

export function validatePasswordMatch(password: string, confirm: string): ValidationResult {
  if (confirm !== password) {
    return { valid: false, error: 'Passwords do not match.' }
  }
  return { valid: true }
}

export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim()

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters.' }
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less.' }
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' }
  }

  return { valid: true }
}
