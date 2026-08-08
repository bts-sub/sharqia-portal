// routes/employee.js — بيانات الموظف الحالي (توافق مع getEmployee في الواجهة)
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";

const router = Router();
router.use(requireAuth);

// GET /api/employee/me → كائن الموظف بالشكل الذي تتوقّعه الواجهة
router.get("/employee/me", async (req, res, next) => {
  try {
    const { data } = await runAction("employee.me", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
