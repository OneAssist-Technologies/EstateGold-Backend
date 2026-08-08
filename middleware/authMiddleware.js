const jwt = require("jsonwebtoken");

module.exports = (
  req,
  res,
  next
) => {
  try {
    const token =
      req.headers.authorization?.split(
        " "
      )[1];

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Unauthorized",
        });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    req.user = decoded;
    if (req.user) {
      req.user._id = decoded._id || decoded.id;
      req.user.id = decoded.id || decoded._id;
    }

    next();
  } catch (error) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Invalid Token",
      });
  }
};