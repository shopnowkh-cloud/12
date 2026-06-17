import { Router, type IRouter } from "express";
import { htmlContent } from "../lib/bot-constants";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.send(htmlContent);
});

export default router;
