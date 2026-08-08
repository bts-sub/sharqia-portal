// routes/leaves.js — الإجازات والرصيد (توافق مع fetchEmployeeLeaves/fetchAllLeaves/getLeaveBalance)
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";

const router = Router();
router.use(requireAuth);

// GET /api/leave/balance → { balance }
router.get("/leave/balance", async (req, res, next) => {
  try {
    const { data } = await runAction("leave.balance", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// الواجهة تنادي POST /api/read/hr.leave بـ domain — نوفّر أيضًا مسارًا صريحًا أوضح:
// GET /api/leaves?onlyApproved=1&employeeId=E1042 → { records: [...] }
router.get("/leaves", async (req, res, next) => {
  try {
    const onlyApproved = ["1", "true"].includes(String(req.query.onlyApproved));
    const { data } = await runAction("leave.list",
      { onlyApproved, employeeId: req.query.employeeId }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// أنواع الإجازات → { records: [{id,name}] }
router.get("/leave/types", async (req, res, next) => {
  try {
    const { data } = await runAction("leaveType.list", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
