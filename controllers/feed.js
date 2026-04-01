// ================== REFACTORED WITH ASYNC/AWAIT ==================

const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");

const io = require("../socket");

const Post = require("../models/post");
const User = require("../models/user"); // make sure this exists

// ================= GET POSTS =================
exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.countDocuments();

    const posts = await Post.find()
      .populate("creator", "name") // populate creator field with name only
      .sort({ createdAt: -1 }) // sort by creation date descending
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Posts fetched successfully.",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

// ================= CREATE POST =================
exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }

    if (!req.file) {
      const error = new Error("No image provided.");
      error.statusCode = 422;
      throw error;
    }

    // const imageUrl = req.file.path.replace(/\\/g, "/");
    const imageUrl = req.file.path.replace(/\\/g, "/").split("images/")[1];
    const finalPath = "images/" + imageUrl;
    const { title, content } = req.body;

    const post = new Post({
      title,
      content,
      imageUrl: finalPath,
      creator: req.userId,
    });

    const savedPost = await post.save();

    const user = await User.findById(req.userId);
    user.posts.push(savedPost);
    await user.save();
    io.getIO().emit("posts", {
      action: "create",
      post: { ...savedPost._doc, creator: { _id: user._id, name: user.name } },
    });
    res.status(201).json({
      message: "Post created successfully!",
      post: savedPost,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

// ================= GET SINGLE POST =================
exports.getPost = async (req, res, next) => {
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Post fetched.",
      post: post,
    });
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

// ================= UPDATE POST =================
exports.updatePost = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error("Validation failed.");
      error.statusCode = 422;
      throw error;
    }

    const { title, content } = req.body;

    let imageUrl = req.body.image;

    if (req.file) {
      imageUrl = req.file.path.replace(/\\/g, "/");
    }

    if (!imageUrl) {
      const error = new Error("No file picked.");
      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator", "name");

    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }

    // AUTH CHECK
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403;
      throw error;
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;

    const updatedPost = await post.save();
    io.getIO().emit("posts", { action: "update", post: updatedPost });
    res.status(200).json({
      message: "Post updated!",
      post: updatedPost,
    });
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

// ================= DELETE POST =================
exports.deletePost = async (req, res, next) => {
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Could not find post.");
      error.statusCode = 404;
      throw error;
    }

    // AUTH CHECK
    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403;
      throw error;
    }

    clearImage(post.imageUrl);

    await Post.findByIdAndDelete(postId);

    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();
    io.getIO().emit("posts", { action: "delete", post: postId });
    res.status(200).json({
      message: "Deleted post.",
    });
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

// ================= CLEAR IMAGE =================
const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);

  fs.unlink(filePath, (err) => {
    if (err) {
      console.log("Image delete error:", err.message);
    }
  });
};
