const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const { clearImage } = require("../util/file");

module.exports = {
  // createUser(args, req) {
  //     const email = args.userInput.email;
  // }

  // The above code is the same as the below code, but with destructuring assignment for better readability and also with used of async/await syntax.
  createUser: async function ({ userInput }, req) {
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      //   const error = new Error("E-mail is invalid.");
      //   throw error;
      errors.push({ message: "E-mail is invalid." });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      //   const error = new Error("Password too short!");
      //   throw error;
      errors.push({ message: "Password too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("User exists already.");
      throw error;
    }
    const hashedPassword = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPassword,
      status: "I am new!",
      posts: [],
    });
    const createdUser = await user.save();
    // return createdUser.toObject({
    //     getters: true
    // });
    console.log("Creating user:", userInput);
    return {
      ...createdUser._doc,
      _id: createdUser._id.toString(),
      password: null,
    };
  },

  login: async function ({ email, password }) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("User not found.");
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Password is incorrect.");
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      "somesupersecretsecret",
      { expiresIn: "1h" },
    );
    return { token: token, userId: user._id.toString() };
  },

  // the below code is for the createPost mutation, but with destructuring assignment for better readability and also with used of async/await syntax.
  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid." });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Content is invalid." });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user.");
      error.code = 401;
      throw error;
    }
    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },

  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }

    const currentPage = page || 1;
    const perPage = 2;
    let totalItems;

    const totalPosts = await Post.find().countDocuments();
    totalItems = totalPosts;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("creator")
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    return {
      posts: posts.map((post) => {
        return {
          ...post._doc,
          _id: post._id.toString(),
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalItems,
    };
  },

  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) {
      throw new Error("Not authenticated!");
    }

    const post = await Post.findById(id).populate("creator");

    if (!post) {
      throw new Error("No post found!");
    }

    // ✅ FIXED AUTH CHECK
    if (post.creator._id.toString() !== req.userId.toString()) {
      throw new Error("Not authorized!");
    }

    // VALIDATION
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      throw new Error("Invalid title");
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      throw new Error("Invalid content");
    }

    // ✅ HANDLE IMAGE UPDATE
    if (postInput.imageUrl) {
      if (post.imageUrl !== postInput.imageUrl) {
        clearImage(post.imageUrl);
        post.imageUrl = postInput.imageUrl;
      }
    }

    post.title = postInput.title;
    post.content = postInput.content;

    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },

  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found!");
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized!");
      error.code = 403;
      throw error;
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(id);

    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();

    return true;
  },

  user: async function( args, req ) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    }
  },

  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }
    user.status = status;
    await user.save();

    return {
      ...user._doc,
      _id: user._id.toString(),
    }
  }
};
