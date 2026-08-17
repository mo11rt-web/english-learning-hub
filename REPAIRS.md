# English Hub (v5) - Diagnosis & Repair Plan

## 1. Student Addition/Deletion (Phone Number Conflict)
- **Issue:** Deleting a student only sets `status: "deleted"`. The Firebase Auth account remains, preventing re-registration with the same phone number.
- **Fix:** 
    - Implement a "Permanent Delete" option in the "Deleted Students" view.
    - Create a new API route `/api/admin/delete-student` using `firebase-admin` to delete the user from both Firebase Auth and Firestore.
    - **Prompt Instruction:** "Create a POST API route at `/api/admin/delete-student` that accepts a `uid`. Use `adminAuth().deleteUser(uid)` and `adminDb().doc(\"profiles/\" + uid).delete()`. Add a 'Permanent Delete' button in the students page that calls this API."

## 2. Password Reset Failure
- **Issue:** The reset password API is likely failing due to missing Environment Variables for the Firebase Admin SDK.
- **Fix:** 
    - Ensure `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` are set.
    - Improve error handling in `src/app/api/admin/reset-password/route.ts` to log specific Auth errors.
    - **Prompt Instruction:** "Verify `src/lib/firebaseAdmin.ts` environment variables. Update the reset-password API to return specific error messages instead of a generic 500."

## 3. Lessons & Assignments Visibility
- **Issue:** Lessons and Assignments don't appear for students because the Firestore query uses `array-contains-any` with `__all__`, but legacy data has empty `targetGroupIds` or is missing the field. Firestore rules also block these.
- **Fix:** 
    - Update `firestore.rules` to allow access if `targetGroupIds` is empty.
    - Update student queries to handle both `__all__` and empty arrays.
    - **Prompt Instruction:** "Update `firestore.rules` for `lessons` and `assignments` to allow read if `resource.data.targetGroupIds.size() == 0`. In `StudentLessonsPage` and `StudentAssignmentsPage`, ensure the query correctly fetches public content."

## 4. Quiz Answer Leakage
- **Issue:** `correctAnswer` is sent to the client in both Irregular Verbs and Assignments, making it possible to 'cheat' or accidentally see answers.
- **Fix:** 
    - For Assignments: The API/Firestore query should exclude `correctAnswer`. Grading must be moved to a Server Action or API route.
    - For Irregular Verbs: Remove `correctAnswer` from the `Question` object and verify answers via a simple API.
    - **Prompt Instruction:** "Secure the grading process. Move `handleSubmit` logic in `TakeAssignmentPage` to a server-side API. Do not send `correctAnswer` to the student's browser."

## 5. File Permissions & Downloads
- **Issue:** Error "لا توجد صلاحية لعرض جميع الملفات".
- **Fix:** 
    - The `files` collection needs a rule that allows students to read files if they are logged in.
    - **Prompt Instruction:** "Check `firestore.rules` for the `files` collection. Ensure `allow read: if isSignedIn()` is active and that the student interface correctly fetches file URLs."

## 6. Multiple Assignments Issue
- **Issue:** Teachers cannot add more than one assignment easily.
- **Fix:** 
    - Reset the `aForm` state completely after a successful `createAssignment` call.
    - **Prompt Instruction:** "In `src/app/assignments/page.tsx`, ensure `setAForm` resets all fields (title, type, targetGroupId, selectedQ) to their initial values after `createDoc` succeeds."

---

## Precise Prompt for the Developer AI:

> "Please apply the following fixes to the English Hub project (v5):
> 1. **Student Deletion:** Implement permanent deletion. Create `/api/admin/delete-student` using Firebase Admin SDK to delete the user from both Auth and Firestore. Add a button in the UI to trigger this for 'deleted' students.
> 2. **Lessons/Assignments Visibility:** Fix the issue where students can't see lessons. Update `firestore.rules` and the frontend queries to allow reading lessons/assignments where `targetGroupIds` is either empty or contains `__all__`.
> 3. **Security:** Stop sending `correctAnswer` to the student's browser. Move the assignment grading logic to a new API route `/api/student/grade-assignment`.
> 4. **UI Fixes:** In the Assignments page, reset the creation form state after saving so multiple assignments can be added. Fix the 'Irregular Verbs' quiz so correct answers aren't visually distinct or leaked in the state before selection.
> 5. **Environment:** Ensure `firebaseAdmin.ts` correctly loads all required secrets for the Admin SDK.
> 6. **File Access:** Fix the 'No permission to view files' error by updating Firestore rules for the `files` collection to allow authenticated students to read."
