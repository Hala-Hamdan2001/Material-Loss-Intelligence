import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import materialRouter from "./material";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(materialRouter);

export default router;
