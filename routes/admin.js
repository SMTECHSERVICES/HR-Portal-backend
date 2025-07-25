import express, { application } from "express"
import jwt from 'jsonwebtoken'
import Intern from "../model/intern.js";
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv'
import HR from "../model/hr.js";
import ExcelJS from 'exceljs';
import { hrProtectMiddleware } from "../middleware/hr.js";
import upload from "../middleware/multer.js";
import cloudinary from "../utils/cloudinary.js";

dotenv.config();

const HR_JWT_SECRET = process.env.HR_JWT_SECRET

const router  = express.Router();



router.post('/login',async(req,res)=>{
        const {email,password} = req.body;
        try {
            const hr = await HR.findOne({
                email,
            });
            if(!hr){
                return res.status(401).json({
                    message:'you are unauthorize'
                })
            }
           const isMatch = await bcrypt.compare(password, hr.password);
               if (!isMatch) {
                 return res.status(401).json({ message: 'Invalid password' });
               }
            const token = jwt.sign({ id: hr._id }, HR_JWT_SECRET, {
                  expiresIn: '7d', // 7 days expiry
                });
            
                // 4. Set cookie with token
                res.cookie('token', token, {
                  httpOnly: true,       // prevents client-side JS access
                  secure: true,        // set to true in production with HTTPS
                  sameSite: 'none',     // CSRF protection
                  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
                });
            

            return res.status(200).json({
                mst:'Login successfull',
                token
            })
        } catch (error) {
            console.log(error)
            return res.status(500).json({
            message:'internal server error'
        })
        }
});

router.use(hrProtectMiddleware)

router.post('/intern/register',async(req,res)=>{
    try {
        const {name,email,phone,university,password} = req.body;
        console.log(email)
        const internAlreadyExist = await Intern.findOne({
            email:email
        })
        console.log(internAlreadyExist)
        if(!internAlreadyExist){
          const newIntern = await Intern.create({
            fullName:name,
            password,
            phoneNumber:phone,
            university,
            email
        });
        console.log(newIntern)

        return res.status(200).json({
            message:'Intern Registerd succefully',
        })
        }
        
   return res.status(400).json({
                message:'Intern Already Exist'
            })
       

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message:"inernal server error"
        })
    }
});

router.get("/allEmployees",async(req,res)=>{
  try {
    const allInterns = await Intern.find().select("-password -attendance -assignment");
    return res.status(200).json({
      allInterns
    })
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message:'Internal server error'
    })
  }
})
router.post('/markAttendance/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const { status, date } = req.body;

    // 1. Validate
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // 2. Find intern
    const intern = await Intern.findById(id);
    if (!intern) {
      return res.status(404).json({ message: 'Intern does not exist' });
    }

    // 3. Determine date to use (either provided or today's date)
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 4. Check if attendance for that date already exists
    const existingEntry = intern.attendance.find(entry => {
      const entryDate = new Date(entry.date).toISOString().split('T')[0];
      return entryDate === targetDate;
    });

    if (existingEntry) {
      // 5. Update status if exists
      existingEntry.status = status;
    } else {
      // 6. Add new attendance entry
      intern.attendance.push({
        date: targetDate,
        status
      });
    }

    // 7. Save intern record
    await intern.save();

    return res.status(200).json({
      message: existingEntry ? 'Attendance updated' : 'Attendance marked successfully',
      attendance: intern.attendance
    });
  } catch (error) {
    console.error('Attendance Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// router.post('/assignTask', async (req, res) => {
//   try {
//     const { email, internName, taskTitle, description, deadline } = req.body;

//     if (!email || !taskTitle || !description || !deadline) {
//       return res.status(400).json({ message: 'All fields are required' });
//     }

//     // 1. Find intern by email
//     const intern = await Intern.findOne({ email }); // fixed typo: findone -> findOne
//     if (!intern) {
//       return res.status(404).json({ message: 'User does not exist' });
//     }

//     // 2. Add new task to assignments
//     intern.assignment.push({
//       title: taskTitle,
//       description,
//       deadline: new Date(deadline),
//     });

//     await intern.save();

//     res.status(200).json({
//       message: `Task assigned to ${intern.fullName}`,
//       assignments: intern.assignment
//     });
//   } catch (error) {
//     console.error('Assign Task Error:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// });

router.post('/assignTask', upload.single('pptFile'), async (req, res) => {
  try {
    const { email, taskTitle, description, deadline } = req.body;

    if (!email || !taskTitle || !description || !deadline) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find intern by email
    const intern = await Intern.findOne({ email });
    if (!intern) {
      return res.status(404).json({ message: 'User does not exist' });
    }

    // Handle optional file upload
    let pptUrl = null;
    if (req.file && req.file.buffer) {
      try {
        const base64File = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const result = await cloudinary.uploader.upload(base64File, {
          folder: 'assignments',
          resource_type: 'raw',
          public_id: `${Date.now()}-${req.file.originalname}`,
        });
        pptUrl = result.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary Upload Failed:', uploadErr);
        return res.status(500).json({ message: 'File upload failed' });
      }
    }

    // Add task to assignment list
    intern.assignment.push({
      title: taskTitle,
      description,
      deadline: new Date(deadline),
      pptFile: pptUrl || null,  // set to null if no file uploaded
    });

    await intern.save();

    res.status(200).json({
      message: `Task assigned to ${intern.fullName}`,
      assignments: intern.assignment,
    });
  } catch (error) {
    console.error('Assign Task Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/allInfo', async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const interns = await Intern.find({});

    const totalInterns = interns.length;

    let presentToday = 0;
    let leaveToday = 0;
    let upcomingAssignments = 0;

    interns.forEach(intern => {
      // Check today's attendance
      const todayAttendance = intern.attendance.find(
        record => record.date >= startOfToday && record.date <= endOfToday
      );

      if (todayAttendance?.status === 'Present') {
        presentToday++;
      } else if (todayAttendance?.status === 'Leave') {
        leaveToday++;
      }

      // Check assignments with future deadline
      intern.assignment.forEach(task => {
        if (new Date(task.deadline) > new Date()) {
          upcomingAssignments++;
        }
      });
    });

    return res.status(200).json({
      totalInterns,
      presentToday,
      leaveToday,
      upcomingAssignments
    });
  } catch (error) {
    console.error('Error in /allInfo:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

router.get("/getEmployeeDetail/:id",async(req,res)=>{
  const id = req.params.id;
  try {
    const user = await Intern.findById(id).select("-password").lean();
    if(!user){
      return res.status(404).json({
        message:'user does not exist'
      })
    }

      if (Array.isArray(user.attendance)) {
      user.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return res.status(200).json({
      user
    })
  } catch (error) {
    console.log(error);
    return res.status(500).json('Internal server error')
  }
})

router.get('/export-interns', async (req, res) => {
  try {
    const interns = await Intern.find();

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Intern Details
    const detailsSheet = workbook.addWorksheet('Intern Details');
    detailsSheet.columns = [
      { header: 'Full Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phoneNumber', width: 15 },
      { header: 'University', key: 'university', width: 25 },
      { header: 'Joined At', key: 'createdAt', width: 20 },
    ];

    interns.forEach(intern => {
      detailsSheet.addRow({
        fullName: intern.fullName,
        email: intern.email,
        phoneNumber: intern.phoneNumber,
        university: intern.university,
        createdAt: intern.createdAt.toLocaleDateString('en-IN'),
      });
    });

    // Sheet 2: Attendance Summary
    const attendanceSheet = workbook.addWorksheet('Attendance Summary');
    attendanceSheet.columns = [
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Month', key: 'month', width: 15 },
      { header: 'Present', key: 'present', width: 10 },
      { header: 'Absent', key: 'absent', width: 10 },
      { header: 'Leave', key: 'leave', width: 10 },
      { header: 'Half Day', key: 'halfday', width: 10 },
      { header: 'Week Off', key: 'weekoff', width: 10 },
    ];

    interns.forEach(intern => {
      const monthlyStats = {};

      intern.attendance.forEach(({ date, status }) => {
        const month = new Date(date).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        if (!monthlyStats[month]) {
          monthlyStats[month] = { Present: 0, Absent: 0, Leave: 0, 'Half Day': 0, 'Week off': 0 };
        }
        monthlyStats[month][status] = (monthlyStats[month][status] || 0) + 1;
      });

      for (const month in monthlyStats) {
        attendanceSheet.addRow({
          name: intern.fullName,
          month,
          present: monthlyStats[month]['Present'] || 0,
          absent: monthlyStats[month]['Absent'] || 0,
          leave: monthlyStats[month]['Leave'] || 0,
          halfday: monthlyStats[month]['Half Day'] || 0,
          weekoff: monthlyStats[month]['Week off'] || 0,
        });
      }
    });

    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Interns_Attendance_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel:', err);
    res.status(500).json({ message: 'Failed to generate Excel file' });
  }
});

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


export default router;