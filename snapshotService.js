// snapshotService.js
import { db } from "./firebase-init.js";
import {
  doc,
  setDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Grava um documento em /snapshots/{id}, fazendo merge se já existir.
 * @param {Object} data — objeto com os campos a gravar
 * @param {string} id   — ID do documento no Firestore
 */
export async function addSnapshotWithId(data, id) {
  const ref = doc(db, "snapshots", id);
  await setDoc(ref, data, { merge: true });
  return ref;
}

/**
 * Grava um documento em /snapshots com ID automático.
 * @param {Object} data — objeto com os campos a gravar
 */
export async function addSnapshotAutoId(data) {
  const ref = await addDoc(collection(db, "snapshots"), data);
  return ref;
}
