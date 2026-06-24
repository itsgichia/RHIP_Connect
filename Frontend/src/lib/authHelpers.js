import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import api from '../hooks/useApi'
import { auth, isFirebaseConfigured } from './firebase'

const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin

const verificationActionSettings = {
  url: `${frontendUrl}/auth/login`,
  handleCodeInApp: false,
}

async function sendFirebaseVerification(user) {
  if (user.emailVerified) {
    throw new Error('Your email is already verified. You can log in.')
  }
  await sendEmailVerification(user, verificationActionSettings)
}

export async function firebaseSignup(form) {
  let credential
  try {
    credential = await createUserWithEmailAndPassword(auth, form.email, form.password)
    await sendFirebaseVerification(credential.user)
  } catch (err) {
    if (err?.code !== 'auth/email-already-in-use') {
      throw err
    }
    // Firebase account exists (e.g. after a DB reseed) — sign in and recreate the local profile.
    credential = await signInWithEmailAndPassword(auth, form.email, form.password)
    if (!credential.user.emailVerified) {
      await sendFirebaseVerification(credential.user)
    }
  }
  const idToken = await credential.user.getIdToken()
  await api.post('/auth/firebase/signup', {
    id_token: idToken,
    name: form.name,
    role: form.role,
    institution_name: form.institution_name,
    specialty_area: form.specialty_area || null,
  })
}

export async function firebaseLogin(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  if (!credential.user.emailVerified) {
    throw new Error('Please verify your email before logging in. Check your inbox.')
  }
  const idToken = await credential.user.getIdToken()
  const { data } = await api.post('/auth/firebase/login', { id_token: idToken })
  return { ...data, email }
}

export async function firebaseForgotPassword(email) {
  await sendPasswordResetEmail(auth, email, verificationActionSettings)
}

export async function firebaseResendVerification(email, password) {
  let user = auth?.currentUser
  if (!user || user.email?.toLowerCase() !== email.toLowerCase()) {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    user = credential.user
  }
  await sendFirebaseVerification(user)
}

export async function resendVerificationEmail({ email, password }) {
  if (useFirebaseAuth()) {
    await firebaseResendVerification(email, password)
    return
  }
  await api.post('/auth/resend-verification', { email })
}

export function useFirebaseAuth() {
  return isFirebaseConfigured()
}
