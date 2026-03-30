import { Router, type IRouter } from "express";
import healthRouter from "./health";
import repoAnalyzeRouter from "./repo/analyze";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/repo", repoAnalyzeRouter);

export default router;
