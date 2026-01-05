# Debug Tool: CourseId Fix

## Summary
Fixed Debug Tool "Force Apply INT_TO_FRAC" failing with "course-not-found: default-course" error.

## Root Cause
Debug Tool was using hardcoded `courseId: "default-course"` while the backend registration uses `"default"`.

## Files Changed

| File | Change |
|------|--------|
| [debug-tool.js](file:///D:/G/viewer/app/debug-tool.js) | Read courseId from UI input with "default" fallback |
| [debug-tool.html](file:///D:/G/viewer/debug-tool.html) | Added "Course Id" input field (prefilled "default") |
| [main.js](file:///D:/G/viewer/app/main.js) | Fixed ensureP1IntegerContext to use "default" |

## Code Changes

### debug-tool.js (line 541-552)
```diff
const endpoint = `${DEBUG_API_BASE}/api/orchestrator/v5/step`;
+const courseIdInput = document.getElementById('course-id-input');
+const courseId = (courseIdInput && courseIdInput.value.trim()) ? courseIdInput.value.trim() : "default";
const payload = {
    ...
-   courseId: "default-course"
+   courseId: courseId
};
```

### debug-tool.html
Added Course Id input:
```html
<div class="input-group">
    <label for="course-id-input">Course Id</label>
    <input type="text" id="course-id-input" value="default" style="width: 100px;">
</div>
```

---

## Verification ✅

1. Open http://localhost:4002/debug-tool.html
2. Enter `2+3` in LaTeX Input
3. Click "AST Debug"
4. Click "2" in preview → target shows `term[0]`, kind `integer`, value `2`
5. Click "Force Apply INT_TO_FRAC"
6. **Result:** `step-applied`, output `\frac{2}{1} + 3` ✅

No "course-not-found" error!

![Verification Recording](file:///C:/Users/v1234/.gemini/antigravity/brain/5fd90b2f-2279-40d5-b9ed-c14e9c33f8b0/debug_tool_course_fix_1765677379910.webp)
