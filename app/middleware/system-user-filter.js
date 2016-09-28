'user strict'

/**
 * Middleware responsible for validating a token using the "system"  user
 * has a user id that matches the configured system user id
 */
module.exports = (logger) => {
    
    return (req, resp, next) => {
        if(req.authUser && req.authUser.handle.toLowerCase() == 'system' && req.authUser.userId != process.env.SYSTEM_USER_ID) {
            resp.status(400).send({
                message: 'Invalid User: User "system"  is reserved!' 
            });
        } else {
            next();
        }
    }
} 
