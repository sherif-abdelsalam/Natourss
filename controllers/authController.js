const catchAsync = require("../utils/catchAsync");
const jwt = require('jsonwebtoken');
const { promisify } = require("util");
const crypto = require("crypto");

const User = require("../models/userModel");
const AppErrors = require("../utils/appErrors");
const { sendEmailWithToken } = require("../utils/email");

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
}

const sendResWithTokenCookie = (user, statusCode, res) => {
    const token = signToken(user._id);

    const cookieOptions = {
        expiresIn: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN),
        httpOnly: true
    };

    if (process.env.NODE_ENV === 'production') {
        cookieOptions.secure = true;
    }

    res.cookie('jwt', token, cookieOptions);

    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        user
    });
}

exports.signup = catchAsync(async (req, res, next) => {

    // this is the right way for inserting new   in the database to avoid any hijacks
    // const newUser = await User.create({
    //     // name: req.body.name,
    //     // email: req.body.email,
    //     // password: req.body.password,
    //     // confirmPassword: req.body.confirmPassword,
    //     // role: req.body.role,
    //     // passwordChangedAt: Date.now()
    // });

    const newUser = await User.create(req.body);
    sendResWithTokenCookie(newUser, 201, res);

});


exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(new AppErrors('Please provide email and password', 400));
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppErrors('Incorrect email or password', 401));
    }
    sendResWithTokenCookie(user, 200, res);
});


exports.protect = catchAsync(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new AppErrors("You are not logged in, Please log in!", 401));
    }
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(new AppErrors("The user belonging to this token does no longer exist", 401));
    }
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppErrors("This user has changed his password recently", 401));
    }
    req.user = currentUser;

    next();
});



exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppErrors("You do not have permission to perform this action", 403));
        }
        next();
    }
};

exports.forgotPassword = catchAsync(async (req, res, next) => {

    //1) Get user based on POSTed email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(new AppErrors("There is no user with that email address", 404));
    }

    //2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });


    //3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

    try {
        await sendEmailWithToken({
            email: user.email,
            subject: "Your password reset token (valid for 10 minutes)",
            message
        });
        res.status(200).json({
            status: "success",
            message: "Token sent to email!"
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(new AppErrors("There was an error sending the email. Try again later!", 500));
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    //1) Get the user based on the token
    const { token } = req.params;
    if (!token) {
        return next(new AppErrors("Token is invalid or has expired", 400));
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
    if (!user) {
        return next(new AppErrors("Token is invalid or has expired", 400));
    }

    //2) If token has not expired, and there is user, set the new password
    user.password = req.body.password;
    user.confirmPassword = req.body.confirmPassword;

    //3) Update changedPasswordAt property for the user

    // user.passwordChangedAt = Date.now();

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    //4) Log the user in, send JWT
    sendResWithTokenCookie(user, 200, res);

});


exports.updatePassword = catchAsync(async (req, res, next) => {

    //1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');
    console.log(user);

    //2) Check if POSTed current password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
        return next(new AppErrors("Your current password is wrong", 401));
    }

    //3) If so, update password
    user.password = req.body.password;
    user.confirmPassword = req.body.confirmPassword;
    await user.save();

    //4) Log user in, send JWT
    sendResWithTokenCookie(user, 200, res);

});