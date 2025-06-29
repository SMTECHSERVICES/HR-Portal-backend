import express from "express"
import jwt from 'jsonwebtoken'
import Intern from "../model/intern.js";
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv'
import { internProtectRoute } from "../middleware/intern.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET

const router  = express.Router();



router.post('/login',async(req,res)=>{
    const {email,password} = req.body;
    console.log(email,password)
    try {
        const intern = await Intern.findOne({email});
        if(!intern){
            return res.status(404).json({
                message:'invalid credential'
            })
        }

       
    const isMatch = await bcrypt.compare(password, intern.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

     const token = jwt.sign({ id: intern._id }, JWT_SECRET, {
      expiresIn: '7d', // 7 days expiry
    });

    // 4. Set cookie with token
    res.cookie('token', token, {
      httpOnly: true,       // prevents client-side JS access
      secure: true,        // set to true in production with HTTPS
      sameSite: 'none',     // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Optional: You can send token here if using JWT
    res.status(200).json({
      message: 'Login successful',
      intern: {
        id: intern._id,
        name: intern.fullName,
        email: intern.email,
        university: intern.university
      },
      token
    });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message:'internal server error'
        })
    }
});


router.use(internProtectRoute)

router.get('/my-attendance',async(req,res)=>{
    try {
        const intern = await Intern.findById(req.user._id);

        if(!intern){
            return res.status(404).json({
                message:'User does not exist'
            })
        };

        return res.status(200).json({
            allAttendance:intern.attendance
        })


    } catch (error) {
        
    }
})


router.get('/my-info',async(req,res)=>{
    try {
        const intern = await Intern.findById(req.user._id).select("-password");

        if(!intern){
            return res.status(404).json({
                message:'User does not exist'
            })
        };

      return res.status(200).json({
        intern
      })


    } catch (error) {
        
    }
});

router.get('/my-tasks',async(req,res)=>{
    try {
        const intern = await Intern.findById(req.user._id);

        if(!intern) {
            return res.status(200).json({
                message:'Intern does not exist'
            })
        }

            return res.status(200).json({
                myTasks:intern.assignment
            })

    } catch (error) {
        
    }
})


router.post('/logout', async (req, res) => {
  try {
    // Get all cookies from the request
    const cookies = req.cookies;
    
    // Clear each cookie individually with proper options
    Object.keys(cookies).forEach(cookieName => {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined
      });
    });

    // Additional security measures
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    
    // Send successful logout response
    res.status(200).json({ 
      success: true,
      message: 'Successfully logged out. All cookies cleared.' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});



export default router