import jwt from 'jsonwebtoken'
import HR from '../model/hr.js';
import dotenv from 'dotenv';

dotenv.config();

const HR_JWT_SECRET = process.env.HR_JWT_SECRET;

export const hrProtectMiddleware  = async(req,res,next)=>{
   // console.log("hi")
    const accessToken = req.cookies.token;
    //console.log(accessToken)
   

    if(!accessToken){
       
        return res.status(401).json({
            message:'please login to access '
        })
    }
    try {
       // console.log('inside try after token found')
        const decodedData = jwt.verify(accessToken,HR_JWT_SECRET);
        //console.log('after decoded')
       const user  = await HR.findById(decodedData.id).select("-password");
       //console.log(user);
        if(!user){
            return res.status(404).json({
                message:'Invalid credential'
            })
        }
        //console.log('before user')
        req.user = user
        
        next();;
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message:'Interna server error'
        })
    }
    
};