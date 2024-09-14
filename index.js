const express = require("express");
const multer = require("multer");
const path = require("path");
const mysql = require("mysql2/promise");
const slugify = require("slugify");
const { v4: uuidv4 } = require("uuid");
const fs = require('fs');
const app = express();
const port = 3000;

// Database connection
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "blogs",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const customImageName = req.body.image_name || "default";
    const fileExtension = path.extname(file.originalname);
    const newFileName = `${customImageName}${fileExtension}`;
    cb(null, newFileName);
  },
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("public/uploads"));

// GET all blog posts
app.get("/api/blog", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM categories ORDER BY created_at DESC"
    );
    res.json({ error: false, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
});

// GET a specific blog post by ID
app.get("/api/blog/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length > 0) {
      res.json({ error: false, data: rows[0] });
    } else {
      res.status(404).json({ error: true, message: "Blog post not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
});

// POST a new blog post
app.post("/api/blog", upload.single("image"), async (req, res) => {
  let imagePath = "";
  if (req.file) {
    imagePath = `/uploads/${req.file.filename}`;
  }

  const formData = {
    category_id: req.body.category_id,
    name: req.body.name,
    slug: slugify(req.body.name, {
      lower: true,
      remove: /[*+~.()'"!:@#%^&${}<>?/|]/g,
    }),
    image: imagePath,
    image_name: req.body.image_name,
    image_alt: req.body.image_alt,
    description: req.body.description,
    bdate: req.body.bdate,
    meta_title: req.body.meta_title,
    meta_keywords: req.body.meta_keywords,
    meta_description: req.body.meta_description,
    publish: req.body.publish,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const [result] = await pool.query("INSERT INTO categories SET ?", formData);
    res.json({
      error: false,
      message: "Successfully created",
      id: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
});

// update blog
app.put('/api/blog/:id', upload.single('image'), async (req, res) => {
  const blogId = req.params.id;
  let imagePath = '';
  const newImageName = req.body.image_name ? req.body.image_name : '';

  try {
    const [rows] = await pool.query('SELECT image FROM categories WHERE id = ?', [blogId]);

    if (rows.length > 0) {
      const oldImagePath = rows[0].image;
      if (req.file) {
        const oldFilePath = path.join(__dirname, 'public', oldImagePath);
        const fileExtension = path.extname(req.file.originalname);
        const newFileName = newImageName + fileExtension;
        const newFilePath = path.join(__dirname, 'public', 'uploads', newFileName);
        fs.renameSync(path.join(__dirname, 'public', oldImagePath), newFilePath);
        imagePath = `/uploads/${newFileName}`;
        if (fs.existsSync(oldFilePath) && oldFilePath !== newFilePath) {
          fs.unlinkSync(oldFilePath);
        }
      } else {
        imagePath = oldImagePath;
        if (newImageName) {
          const fileExtension = path.extname(oldImagePath);
          const newFileName = newImageName + fileExtension;
          const newFilePath = path.join(__dirname, 'public', 'uploads', newFileName);
          fs.renameSync(path.join(__dirname, 'public', oldImagePath), newFilePath);
          imagePath = `/uploads/${newFileName}`;
        }
      }

      const formData = {
        category_id: req.body.category_id,
        name: req.body.name,
        slug: slugify(req.body.name, {
          lower: true,
          remove: /[*+~.()'"!:@#%^&${}<>?/|]/g,
        }),
        image: imagePath,
        image_name: newImageName || req.body.image_name,
        image_alt: req.body.image_alt,
        description: req.body.description,
        bdate: req.body.bdate,
        meta_title: req.body.meta_title,
        meta_keywords: req.body.meta_keywords,
        meta_description: req.body.meta_description,
        publish: req.body.publish === 'on', // Checkbox returns 'on' if checked
        updated_at: new Date().toISOString(),
      };

      // Update the blog post in the database
      const [result] = await pool.query('UPDATE categories SET ? WHERE id = ?', [formData, blogId]);
      if (result.affectedRows > 0) {
        res.json({ error: false, message: "Successfully updated" });
      } else {
        res.status(404).json({ error: true, message: "Blog post not found" });
      }
    } else {
      res.status(404).json({ error: true, message: "Blog post not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
