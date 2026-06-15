import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import api from '../hooks/useApi'
import { auth, isFirebaseConfigured } from './firebase'

const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin

export async function firebaseSignup(form) {
  let credential
  try {
    credential = await createUserWithEmailAndPassword(auth, form.email, form.password)
    await sendEmailVerification(credential.user, {
      url: `${frontendUrl}/auth/login`,
      handleCodeInApp: false,
    })
  } catch (err) {
    if (err?.code !== 'auth/email-already-in-use') {
      throw err
    }
    // Firebase account exists (e.g. after a DB reseed) — sign in and recreate the local profile.
    credential = await signInWithEmailAndPassword(auth, form.email, form.password)
    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user, {
        url: `${frontendUrl}/auth/login`,
        handleCodeInApp: false,
      })
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
  await sendPasswordResetEmail(auth, email, {
    url: `${frontendUrl}/auth/login`,
    handleCodeInApp: false,
  })
}

export function useFirebaseAuth() {
  return isFirebaseConfigured()
}
