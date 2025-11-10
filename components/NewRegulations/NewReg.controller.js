const supabase = require("../../supabaseClient");

const getAllCourses = async (req, res) => {
  try {
    const { degree, department } = req.query;

    let query = supabase.from("credits").select("*");
    if (degree) query = query.eq("degree", degree);
    if (department) query = query.eq("department", department);

    const { data: allCourses, error } = await query;

    if (error) throw error;
    
    if (allCourses.length === 0) {
      return res.json([]);
    }

    const regulationYears = allCourses
      .map(course => course.course_code?.substring(0, 2))
      .filter(Boolean)
      .map(year => parseInt(year, 10))
      .filter(year => !isNaN(year));

    if (regulationYears.length === 0) {
      return res.json(allCourses);
    }

    const mostRecentYear = Math.max(...regulationYears);
    
    const mostRecentCourses = allCourses.filter(course => 
      course.course_code?.startsWith(mostRecentYear.toString().padStart(2, '0'))
    );

    mostRecentCourses.sort((a, b) => (a.serial_no || 0) - (b.serial_no || 0));
    
    res.json(mostRecentCourses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateCourse = async (req, res) => {
  const { course_name } = req.params;
  const updatedCourse = req.body;
  const { degree, department } = updatedCourse;

  try {
    // Make sure we have the composite key values
    if (!degree || !department || !course_name) {
      return res.status(400).json({ message: "Course name, degree, and department are required" });
    }
    
    const { data, error } = await supabase
      .from("credits")
      .update(updatedCourse)
      .eq("course_name", course_name)
      .eq("degree", degree)
      .eq("department", department)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }
    
    if (data.length === 0) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    res.json({ message: "Course updated successfully", data: data[0] });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteMoveCourse = async (req, res) => {
  const { course_name } = req.params;
  const { degree, department } = req.body;

  try {
    // Make sure we have the composite key values
    if (!degree || !department || !course_name) {
      return res.status(400).json({ message: "Course name, degree, and department are required" });
    }

    // FETCH the course first to get ca_marks, fe_marks, total_marks
    const { data: existingCourse, error: fetchError } = await supabase
      .from("credits")
      .select("ca_marks, fe_marks, total_marks")
      .eq("course_name", course_name)
      .eq("degree", degree)
      .eq("department", department)
      .single();

    if (fetchError) {
      console.error("Error fetching course for deletion:", fetchError);
      throw fetchError;
    }

    // Now delete the course
    const { data, error } = await supabase
      .from("credits")
      .delete()
      .eq("course_name", course_name)
      .eq("degree", degree)
      .eq("department", department);

    if (error) {
      console.error("Supabase delete error:", error);
      throw error;
    }

    // Return the deleted course data including marks
    res.json({ 
      message: "Course deleted successfully!", 
      data,
      preservedMarks: existingCourse // Send back the marks to be used in frontend
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Error deleting course", error: error.message });
  }
};

// const addCourse = async (req, res) => {
//   const newCourse = req.body;

//   // Validate required composite key fields
//   if (!newCourse.course_name || !newCourse.course_name.trim()) {
//     return res.status(400).json({ 
//       message: "Course name is required and cannot be empty." 
//     });
//   }

//   if (!newCourse.degree || !newCourse.department) {
//     return res.status(400).json({ 
//       message: "Degree and department are required." 
//     });
//   }

//   // RELAXED VALIDATION: Only check if marks are missing, fetch from existing course
//   const marksProvided = newCourse.ca_marks != null && 
//                         newCourse.fe_marks != null && 
//                         newCourse.total_marks != null;

//   try {
//     // Check if a course with the same composite key exists
//     const { data: existingCourse, error: checkError } = await supabase
//       .from("credits")
//       .select("*")
//       .eq("course_name", newCourse.course_name.trim())
//       .eq("degree", newCourse.degree)
//       .eq("department", newCourse.department);

//     if (checkError) {
//       console.error("Database check error:", checkError);
//       throw checkError;
//     }

//     if (existingCourse && existingCourse.length > 0) {
//       return res.status(409).json({ 
//         message: "A course with this name already exists for this degree and department." 
//       });
//     }

//     // If marks not provided, try to fetch from another course with same name
//     let ca_marks = newCourse.ca_marks;
//     let fe_marks = newCourse.fe_marks;
//     let total_marks = newCourse.total_marks;

//     if (!marksProvided) {
//       const { data: similarCourse, error: similarError } = await supabase
//         .from("credits")
//         .select("ca_marks, fe_marks, total_marks")
//         .eq("course_name", newCourse.course_name.trim())
//         .eq("degree", newCourse.degree)
//         .limit(1)
//         .single();

//       if (!similarError && similarCourse) {
//         ca_marks = similarCourse.ca_marks;
//         fe_marks = similarCourse.fe_marks;
//         total_marks = similarCourse.total_marks;
//         console.log("Using marks from existing course with same name:", similarCourse);
//       } else {
//         // If still no marks found, use defaults
//         ca_marks = ca_marks ?? 0;
//         fe_marks = fe_marks ?? 0;
//         total_marks = total_marks ?? 0;
//       }
//     }

//     // Prepare the course data
//     const courseToInsert = {
//       ...newCourse,
//       course_name: newCourse.course_name.trim(),
//       course_code: newCourse.course_code || '',
//       lecture: newCourse.lecture || 0,
//       tutorial: newCourse.tutorial || 0,
//       practical: newCourse.practical || 0,
//       credits: newCourse.credits || 0,
//       type: newCourse.type || '',
//       faculty: newCourse.faculty || '',
//       category: newCourse.category || '',
//       serial_no: newCourse.serial_no || 0,
//       sem_no: newCourse.sem_no || 1,
//       ca_marks,
//       fe_marks,
//       total_marks
//     };

//     const { data, error } = await supabase
//       .from("credits")
//       .insert(courseToInsert)
//       .select();

//     if (error) {
//       console.error("Database insert error:", error);
//       throw error;
//     }

//     res.json(data[0] || { message: "Course added successfully!" });
//   } catch (error) {
//     console.error("Error in addCourse:", error);
//     res.status(500).json({ 
//       message: "Error adding course", 
//       error: error.message,
//       details: error.details || error.hint || null 
//     });
//   }
// };

const addCourse = async (req, res) => {
  const newCourse = req.body;

  // Validate required composite key fields
  if (!newCourse.course_name || !newCourse.course_name.trim()) {
    return res.status(400).json({ 
      message: "Course name is required and cannot be empty." 
    });
  }

  if (!newCourse.degree || !newCourse.department) {
    return res.status(400).json({ 
      message: "Degree and department are required." 
    });
  }

  // RELAXED VALIDATION: Only check if marks are missing, fetch from existing course
  const marksProvided = newCourse.ca_marks != null && 
                        newCourse.fe_marks != null && 
                        newCourse.total_marks != null;

  try {
    // If marks not provided, try to fetch from another course with same name and degree
    let ca_marks = newCourse.ca_marks;
    let fe_marks = newCourse.fe_marks;
    let total_marks = newCourse.total_marks;

    if (!marksProvided) {
      const { data: similarCourse, error: similarError } = await supabase
        .from("credits")
        .select("ca_marks, fe_marks, total_marks")
        .eq("course_name", newCourse.course_name.trim())
        .eq("degree", newCourse.degree)
        .limit(1)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

      if (!similarError && similarCourse) {
        ca_marks = similarCourse.ca_marks;
        fe_marks = similarCourse.fe_marks;
        total_marks = similarCourse.total_marks;
        console.log("Using marks from existing course with same name:", similarCourse);
      } else {
        // If still no marks found, use defaults
        ca_marks = ca_marks ?? 0;
        fe_marks = fe_marks ?? 0;
        total_marks = total_marks ?? 0;
        console.log("No existing marks found, using defaults");
      }
    }

    // Prepare the course data
    const courseToInsert = {
      course_name: newCourse.course_name.trim(),
      degree: newCourse.degree,
      department: newCourse.department,
      course_code: newCourse.course_code || '',
      lecture: newCourse.lecture || 0,
      tutorial: newCourse.tutorial || 0,
      practical: newCourse.practical || 0,
      credits: newCourse.credits || 0,
      type: newCourse.type || '',
      faculty: newCourse.faculty || '',
      category: newCourse.category || '',
      serial_no: newCourse.serial_no || 0,
      sem_no: newCourse.sem_no || 1,
      ca_marks,
      fe_marks,
      total_marks
    };

    // Use UPSERT: insert or update if composite key exists
    const { data, error } = await supabase
      .from("credits")
      .upsert(courseToInsert, {
        onConflict: 'course_name,degree,department', // Composite primary key
        ignoreDuplicates: false // Update if exists
      })
      .select();

    if (error) {
      console.error("Database upsert error:", error);
      throw error;
    }

    res.json(data[0] || { message: "Course added/updated successfully!" });
  } catch (error) {
    console.error("Error in addCourse:", error);
    res.status(500).json({ 
      message: "Error adding course", 
      error: error.message,
      details: error.details || error.hint || null 
    });
  }
};


const deleteCourse = async (req, res) => {
  const { course_name } = req.params;
  const { degree, department } = req.body;

  try {
    // Make sure we have the composite key values
    if (!degree || !department || !course_name) {
      return res.status(400).json({ message: "Course name, degree, and department are required" });
    }

    const { data, error } = await supabase
      .from("credits")
      .delete()
      .eq("course_name", course_name)
      .eq("degree", degree)
      .eq("department", department)
      .select();

    if (error) {
      console.error("Supabase delete error:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ message: "Course deleted successfully!", data });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Error deleting course", error: error.message });
  }
};

const confirmRegulation = async (req, res) => {
  const { courses, degree, department, regulationYear } = req.body;

  if (!courses || !Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({ message: "No courses provided" });
  }

  if (!degree || !department) {
    return res.status(400).json({ message: "Degree and department are required" });
  }

  if (!regulationYear) {
    return res.status(400).json({ message: "Regulation year is required" });
  }

  const departmentWithYear = `${department}-${regulationYear}`;

  try {
    // Fetch existing courses to get common values
    const { data: existingCourses, error: fetchError } = await supabase
      .from("credits")
      .select("course_name, ca_marks, fe_marks, total_marks")
      .eq("degree", degree)
      .eq("department", department);

    if (fetchError) {
      console.error("Error fetching existing courses:", fetchError);
      throw fetchError;
    }

    // Create a map of course names to their common values
    const courseCommonValuesMap = {};
    if (existingCourses && existingCourses.length > 0) {
      existingCourses.forEach(course => {
        courseCommonValuesMap[course.course_name] = {
          ca_marks: course.ca_marks,
          fe_marks: course.fe_marks,
          total_marks: course.total_marks
        };
      });
    }

    // Prepare courses for insertion with the new department suffix
    const coursesToInsert = courses.map(course => {
      const commonValues = courseCommonValuesMap[course.course_name] || {
        ca_marks: null,
        fe_marks: null,
        total_marks: null
      };

      return {
        course_code: course.course_code || '',
        course_name: course.course_name || "",
        sem_no: course.sem_no || 1,
        degree,
        department: departmentWithYear,
        lecture: course.lecture || 0,
        tutorial: course.tutorial || 0,
        practical: course.practical || 0,
        credits: course.credits || 0,
        type: course.type || "",
        faculty: course.faculty || "",
        category: course.category || "",
        serial_no: course.serial_no || 0,
        ca_marks: commonValues.ca_marks,
        fe_marks: commonValues.fe_marks,
        total_marks: commonValues.total_marks
      };
    });

    // Insert the courses
    const { data, error } = await supabase
      .from("credits")
      .insert(coursesToInsert)
      .select();
    
    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }

    res.json({ 
      message: "New regulation confirmed successfully!",
      department: departmentWithYear,
      coursesAdded: data ? data.length : 0
    });
  } catch (error) {
    console.error("Error confirming regulation:", error);
    res.status(500).json({ 
      message: "Error confirming regulation", 
      error: error.message,
      details: error.details || error.hint || null
    });
  }
};

module.exports = { 
  getAllCourses, 
  updateCourse, 
  deleteMoveCourse, 
  addCourse, 
  deleteCourse, 
  confirmRegulation 
};